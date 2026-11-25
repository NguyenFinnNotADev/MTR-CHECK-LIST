// Thin I/O layer. Inside Tauri → Rust commands; in a plain browser (dev preview) → /mtr + localStorage.
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const assetBase = isTauri ? 'http://mtr.localhost/' : '/mtr/';
export const iconUrl = (id: string) => `${assetBase}icons/${encodeURIComponent(id)}.png`;

const LS = 'mtr:';
const lsGet = (k: string) => { try { return localStorage.getItem(LS + k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(LS + k, v); } catch { /* ignore */ } };

export async function readDatabase(file: string): Promise<unknown> {
  if (isTauri) {
    const t = await invoke<string | null>('read_text', { rel: `database/${file}` });
    return t ? JSON.parse(t) : null;
  }
  const r = await fetch(`/mtr/database/${file}`);
  return r.ok ? r.json() : null;
}

export async function readData(rel: string): Promise<string | null> {
  if (isTauri) return invoke<string | null>('read_text', { rel: `data/${rel}` });
  return lsGet(rel);
}

export async function writeData(rel: string, content: string, backup = true): Promise<void> {
  if (isTauri) return invoke('write_text', { rel: `data/${rel}`, content, backup });
  lsSet(rel, content);
}

export async function writeDatabase(file: string, content: string): Promise<void> {
  if (isTauri) return invoke('write_text', { rel: `database/${file}`, content, backup: true });
  lsSet(`db/${file}`, content);
}

export async function listData(dir: string): Promise<string[]> {
  if (isTauri) return invoke<string[]>('list_dir', { rel: `data/${dir}` });
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (k.startsWith(`${LS}${dir}/`)) out.push(k.slice(LS.length + dir.length + 1));
    }
  } catch { /* ignore */ }
  return out;
}

export async function deleteData(rel: string): Promise<void> {
  if (isTauri) return invoke('delete_file', { rel: `data/${rel}` });
  try { localStorage.removeItem(LS + rel); } catch { /* ignore */ }
}

/** Start folder for the file picker: <instance>\config\litematica when it exists, else the folder itself. */
async function materialStartDir(dir: string | null | undefined): Promise<string | undefined> {
  if (!dir || !isTauri) return undefined;
  const lit = `${dir.replace(/[\\/]+$/, '')}\\config\\litematica`;
  if (await invoke<boolean>('dir_exists', { path: lit })) return lit;
  if (await invoke<boolean>('dir_exists', { path: dir })) return dir;
  return undefined;
}

/** Ask for a Litematica .txt; returns {name, text, archived} or null. */
export async function pickMaterialList(dir?: string | null): Promise<{ fileName: string; text: string; archived?: string } | null> {
  if (isTauri) {
    const defaultPath = await materialStartDir(dir);
    const p = await open({ multiple: false, directory: false, defaultPath, filters: [{ name: 'Litematica material list', extensions: ['txt'] }] });
    if (!p || Array.isArray(p)) return null;
    const text = await invoke<string>('read_external', { path: p });
    let archived: string | undefined;
    try { archived = await invoke<string>('archive_import', { path: p }); } catch { /* non-fatal */ }
    return { fileName: p.split(/[\\/]/).pop() ?? 'list.txt', text, archived };
  }
  return pickInBrowser('.txt');
}

export async function exportBackup(content: string): Promise<boolean> {
  const d = new Date(); // local date, not UTC
  const name = `MTR-backup-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
  if (isTauri) {
    const p = await save({ defaultPath: name, filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (!p) return false;
    await invoke('write_external', { path: p, content });
    return true;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  a.download = name;
  a.click();
  return true;
}

export async function pickBackup(): Promise<string | null> {
  if (isTauri) {
    const p = await open({ multiple: false, filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (!p || Array.isArray(p)) return null;
    return invoke<string>('read_external', { path: p });
  }
  return (await pickInBrowser('.json'))?.text ?? null;
}

export async function openDataFolder(): Promise<void> {
  if (isTauri) await invoke('open_data_folder');
}

export async function pickFolder(start?: string | null): Promise<string | null> {
  if (!isTauri) return null;
  const p = await open({ directory: true, multiple: false, defaultPath: start ?? undefined });
  return typeof p === 'string' ? p : null;
}
export async function findLitematicaDirs(): Promise<string[]> {
  return isTauri ? invoke<string[]>('find_litematica_dirs') : [];
}
export async function relaunch() { if (isTauri) await invoke('relaunch'); else location.reload(); }
export async function quitApp() { if (isTauri) await invoke('quit_app'); }
export async function closeMiniWindow() { if (isTauri) await invoke('close_mini'); else window.close(); }
/** Listen to a Rust → page event (no-op in the browser preview). */
export async function onAppEvent(name: string, fn: () => void) {
  if (!isTauri) return;
  const { listen } = await import('@tauri-apps/api/event');
  await listen(name, () => fn());
}

// ---------- windows ----------
// Tauri: the mini window has label "mini" (readable synchronously); browser preview: ?mini
const tauriLabel = (globalThis as { __TAURI_INTERNALS__?: { metadata?: { currentWindow?: { label?: string } } } })
  .__TAURI_INTERNALS__?.metadata?.currentWindow?.label;
export const isMini = tauriLabel ? tauriLabel === 'mini'
  : typeof location !== 'undefined' && new URLSearchParams(location.search).has('mini');
export const windowLabel = isMini ? 'mini' : 'main';

/** Cross-window sync: every persisted change is broadcast; other windows apply it. */
type Msg = { from: string; kind: string; payload: unknown };
const bc = !isTauri && typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('mtr') : null;
export async function broadcast(kind: string, payload: unknown) {
  const msg: Msg = { from: windowLabel, kind, payload };
  if (isTauri) {
    const { emit } = await import('@tauri-apps/api/event');
    await emit('mtr-sync', msg);
  } else bc?.postMessage(msg);
}
export async function onBroadcast(fn: (kind: string, payload: unknown) => void) {
  const handle = (m: Msg) => { if (m && m.from !== windowLabel) fn(m.kind, m.payload); };
  if (isTauri) {
    const { listen } = await import('@tauri-apps/api/event');
    await listen<Msg>('mtr-sync', e => handle(e.payload));
  } else if (bc) bc.onmessage = e => handle(e.data as Msg);
}

export async function openMini(o: { x?: number; y?: number; w: number; h: number; onTop: boolean; hideMain: boolean }) {
  if (isTauri) return invoke('open_mini', { x: o.x ?? null, y: o.y ?? null, w: o.w, h: o.h, onTop: o.onTop, hideMain: o.hideMain });
  window.open('/?mini=1', 'mtr-mini', `width=${o.w},height=${o.h}`);
}
export async function showMain() { if (isTauri) await invoke('show_main'); }
export async function closeThisWindow() {
  if (isTauri) { const { getCurrentWindow } = await import('@tauri-apps/api/window'); await getCurrentWindow().close(); }
  else window.close();
}
export async function setOnTop(v: boolean) {
  if (isTauri) { const { getCurrentWindow } = await import('@tauri-apps/api/window'); await getCurrentWindow().setAlwaysOnTop(v); }
}
/** Report logical bounds whenever this window moves/resizes (debounced by caller). */
export async function watchBounds(fn: (b: { x: number; y: number; w: number; h: number }) => void) {
  if (!isTauri) return;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const w = getCurrentWindow();
  const report = async () => {
    const sf = await w.scaleFactor();
    const pos = await w.outerPosition(), size = await w.innerSize();
    fn({ x: Math.round(pos.x / sf), y: Math.round(pos.y / sf), w: Math.round(size.width / sf), h: Math.round(size.height / sf) });
  };
  await w.onMoved(() => void report());
  await w.onResized(() => void report());
}

function pickInBrowser(accept: string): Promise<{ fileName: string; text: string } | null> {
  return new Promise(resolve => {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = accept;
    i.onchange = async () => {
      const f = i.files?.[0];
      resolve(f ? { fileName: f.name, text: await f.text() } : null);
    };
    i.click();
  });
}
