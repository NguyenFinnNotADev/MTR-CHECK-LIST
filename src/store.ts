import { create } from 'zustand';
import { buildDb, slug, type RawDb } from './core/db';
import type { ParsedList } from './core/parse';
import { createProject, duplicateProject, newId, reresolve, resetProject } from './core/project';
import { withHistory } from './core/plan';
import { activateRow, setCollected, setStatus, settleActive } from './core/state';
import type { AnimLevel, Db, DbGroup, GameMap, Project, ProjectItem, Settings, Status, UserOverrides } from './core/types';
import * as io from './platform';

export type Tab = 'materials' | 'plan' | 'maps' | 'settings';

const DEFAULT_SETTINGS: Settings = {
  lang: 'duo', theme: 'beige', sort: 'farm', reverse: false, currentProject: null, ownedCollapsed: false, statusFilter: 'all',
  hideMainOnMini: false, miniOnTop: true, miniOpacity: 1, miniBounds: null, anim: 'lite', materialsDir: null,
};
const THEMES: Settings['theme'][] = ['white', 'black', 'gray', 'beige', 'blue', 'medieval', 'pink'];
const OLD_THEME: Record<string, Settings['theme']> = { cabin: 'beige', night: 'black', meadow: 'blue' };

interface State {
  ready: boolean;
  error: string | null;
  saveError: string | null;
  rawDb: RawDb | null;
  db: Db | null;
  maps: GameMap[];
  projects: Record<string, Project>;
  settings: Settings;
  tab: Tab;
  search: string;
  openGroups: Record<string, boolean>; // raw-total strip open state (per session)
  selectedMap: string | null; // map tab selection
  bootAnim: AnimLevel; // animation level in effect for this run (changes apply after relaunch)
  justDone: { key: string; at: number } | null;
  busy: 'saving' | 'loading' | null; // full-window overlay
  setBusy(b: 'saving' | 'loading' | null): void;
  relaunchApp(): Promise<void>;

  init(): Promise<void>;
  setTab(t: Tab): void;
  setSearch(s: string): void;
  setSettings(p: Partial<Settings>): void;
  toggleGroup(key: string): void;
  selectProject(id: string): void;
  selectMap(id: string): void;

  importList(parsed: ParsedList, name: string, mapId: string, archived?: string): void;
  renameProject(id: string, name: string): void;
  moveProject(id: string, mapId: string): void;
  duplicate(id: string): void;
  reset(id: string): void;
  deleteProject(id: string): void;

  clickItem(key: string): void;
  setItemStatus(key: string, s: Status): void;
  setItemCollected(key: string, n: number): void;

  addMap(name: string): string;
  renameMap(id: string, name: string): void;
  deleteMap(id: string, moveTo: string | null): void;
  toggleFarm(mapId: string, farmId: string): void;
  setItemNote(mapId: string, key: string, text: string): void;
  setFarmNote(mapId: string, farmId: string, text: string): void;
  openMini(): Promise<void>;

  classify(rawName: string, o: { group: string; newGroup?: { en: string; farms: string[]; howTo: string }; vi?: string; stack?: number }): void;

  exportAll(): string;
  importAll(json: string): void;
}

type Get = () => State;
type Set = (p: Partial<State>) => void;

// ---------- debounced persistence ----------
const dirty = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
let storeRef: { get: Get; set: Set } | null = null;
let initPromise: Promise<void> | null = null;

function schedule(get: Get, set: Set, ...keys: string[]) {
  keys.forEach(k => dirty.add(k));
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flush(get, set), 500);
  // keep the other window (main ↔ mini) in sync; only the window that made a change saves it
  const s = get();
  for (const k of keys) {
    const payload = k === 'settings' ? s.settings : k === 'maps' ? s.maps : k === 'overrides' ? s.db?.overrides : k.startsWith('p:') ? s.projects[k.slice(2)] ?? null : undefined;
    void io.broadcast(k, payload).catch(() => {});
  }
}

function applyRemote(get: Get, set: Set, kind: string, payload: unknown) {
  if (kind === 'settings') set({ settings: { ...get().settings, ...(payload as Settings) } });
  else if (kind === 'maps') set({ maps: payload as GameMap[] });
  else if (kind === 'overrides') {
    const rawDb = get().rawDb;
    if (rawDb) { const nr = { ...rawDb, overrides: payload as UserOverrides }; set({ rawDb: nr, db: buildDb(nr) }); }
  } else if (kind.startsWith('p:')) {
    const id = kind.slice(2);
    const projects = { ...get().projects };
    if (payload) projects[id] = payload as Project; else delete projects[id];
    set({ projects });
  }
}
async function flush(get: Get, set: Set) {
  const keys = [...dirty];
  dirty.clear();
  const s = get();
  try {
    for (const k of keys) {
      if (k === 'settings') await io.writeData('app.json', JSON.stringify(s.settings, null, 1), false);
      else if (k === 'maps') await io.writeData('maps.json', JSON.stringify(s.maps, null, 1));
      else if (k === 'overrides' && s.db) await io.writeDatabase('user_overrides.json', JSON.stringify(s.db.overrides, null, 1));
      else if (k.startsWith('p:')) {
        const id = k.slice(2);
        const p = s.projects[id];
        if (p) await io.writeData(`projects/${id}.json`, JSON.stringify(p));
        else await io.deleteData(`projects/${id}.json`);
      }
    }
    if (s.saveError) set({ saveError: null });
  } catch (e) {
    keys.forEach(k => dirty.add(k)); // retry on next change
    set({ saveError: String(e) });
  }
}
/** Write every pending change now (used before the window closes). */
export async function flushNow() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (dirty.size && storeRef) await flush(storeRef.get, storeRef.set);
}
export const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
// flush pending writes when the page unloads (the close flow itself lives in App / Mini)
if (typeof window !== 'undefined') window.addEventListener('beforeunload', () => { void flushNow(); });

const parse = <T,>(s: string | null, fb: T): T => { try { return s ? (JSON.parse(s) as T) : fb; } catch { return fb; } };

async function loadAll(get: Get, set: Set) {
  try {
    const [items, groups, farms, recipes, langIndex, overrides] = await Promise.all(
      ['items.json', 'groups.json', 'farms.json', 'recipes.json', 'lang_index.json', 'user_overrides.json'].map(f => io.readDatabase(f)),
    );
    if (!items || !groups) throw new Error('Thiếu folder database\\ cạnh file exe.');
    const rawDb = { items, groups, farms, recipes, langIndex, overrides: (overrides ?? { items: {}, groups: [] }) as UserOverrides } as RawDb;
    const db = buildDb(rawDb);
    const saved = parse<Partial<Settings> & { animations?: boolean }>(await io.readData('app.json'), {});
    const settings = { ...DEFAULT_SETTINGS, ...saved };
    if (!THEMES.includes(settings.theme)) settings.theme = OLD_THEME[settings.theme as string] ?? 'beige';
    if (!saved.anim && typeof saved.animations === 'boolean') settings.anim = saved.animations ? 'lite' : 'off';
    delete (settings as { animations?: boolean }).animations;
    let maps = parse<GameMap[]>(await io.readData('maps.json'), []);
    const freshMap = !maps.length;
    if (freshMap) maps = [{ id: newId('m'), name: settings.lang === 'en' ? 'My map' : 'Map của tôi', ownedFarms: [] }];
    const projects: Record<string, Project> = {};
    for (const f of await io.listData('projects')) {
      if (!f.endsWith('.json')) continue;
      const p = parse<Project | null>(await io.readData(`projects/${f}`), null);
      if (p?.id) projects[p.id] = reresolve(db, p);
    }
    // projects whose map vanished go to the first map
    for (const p of Object.values(projects)) if (!maps.some(m => m.id === p.mapId)) projects[p.id] = { ...p, mapId: maps[0].id };
    if (settings.currentProject && !projects[settings.currentProject]) settings.currentProject = Object.keys(projects)[0] ?? null;
    set({ ready: true, rawDb, db, maps, projects, settings, bootAnim: settings.anim, selectedMap: maps[0]?.id ?? null });
    storeRef = { get, set };
    await io.onBroadcast((kind, payload) => applyRemote(get, set, kind, payload));
    if (freshMap && !io.isMini) schedule(get, set, 'maps');
  } catch (e) {
    set({ ready: true, error: String(e) });
  }
}

export const useStore = create<State>((set, get) => {
  const patchProject = (id: string | null, fn: (p: Project) => Project) => {
    if (!id) return;
    const p = get().projects[id];
    if (!p) return;
    const np = withHistory({ ...fn(p), updatedAt: new Date().toISOString() });
    // remember which item just became "done" (drives the celebration animation)
    const before = new Map(p.items.map(i => [i.key, i.status]));
    const justDone = np.items.find(i => i.status === 'done' && before.get(i.key) !== 'done')?.key;
    set({ projects: { ...get().projects, [id]: np }, ...(justDone ? { justDone: { key: justDone, at: Date.now() } } : {}) });
    schedule(get, set, `p:${id}`);
  };
  const patchItem = (key: string, fn: (it: ProjectItem) => ProjectItem) =>
    patchProject(get().settings.currentProject, p => ({ ...p, items: p.items.map(i => (i.key === key ? fn(i) : i)) }));

  return {
    ready: false, error: null, saveError: null, rawDb: null, db: null, maps: [], projects: {},
    settings: DEFAULT_SETTINGS, tab: 'materials', search: '', openGroups: {}, selectedMap: null,
    bootAnim: 'lite', busy: null, justDone: null,
    setBusy: busy => set({ busy }),
    async relaunchApp() {
      set({ busy: 'saving' });
      await flushNow();
      await wait(get().bootAnim === 'off' ? 0 : 400);
      await io.relaunch();
    },

    init() {
      initPromise ??= loadAll(get, set);
      return initPromise;
    },

    setTab: tab => set({ tab }),
    setSearch: search => set({ search }),
    setSettings: p => { set({ settings: { ...get().settings, ...p } }); schedule(get, set, 'settings'); },
    toggleGroup: key => set({ openGroups: { ...get().openGroups, [key]: !get().openGroups[key] } }),
    selectProject: id => {
      const cur = get().settings.currentProject;
      if (cur && cur !== id) patchProject(cur, p => (p.active ? { ...p, items: settleActive(p.items, p.active), active: null } : p));
      get().setSettings({ currentProject: id });
      set({ tab: 'materials' });
    },
    selectMap: id => set({ selectedMap: id }),

    importList(parsed, name, mapId, archived) {
      const p = createProject(get().db!, parsed, name, mapId, archived);
      set({ projects: { ...get().projects, [p.id]: p }, tab: 'materials' });
      get().setSettings({ currentProject: p.id });
      schedule(get, set, `p:${p.id}`);
    },
    renameProject: (id, name) => patchProject(id, p => ({ ...p, name })),
    moveProject: (id, mapId) => patchProject(id, p => ({ ...p, mapId })),
    duplicate(id) {
      const src = get().projects[id];
      if (!src) return;
      const p = duplicateProject(src, `${src.name} (2)`);
      set({ projects: { ...get().projects, [p.id]: p } });
      get().setSettings({ currentProject: p.id });
      schedule(get, set, `p:${p.id}`);
    },
    reset: id => patchProject(id, resetProject),
    deleteProject(id) {
      const projects = { ...get().projects };
      const mapId = projects[id]?.mapId;
      delete projects[id];
      set({ projects });
      if (get().settings.currentProject === id) {
        // prefer another build on the same map
        const next = Object.values(projects).find(p => p.mapId === mapId) ?? Object.values(projects)[0];
        get().setSettings({ currentProject: next?.id ?? null });
      }
      schedule(get, set, `p:${id}`);
    },

    clickItem: key => patchProject(get().settings.currentProject, p => {
      const r = activateRow(p.items, p.active ?? null, key);
      return { ...p, items: r.items, active: r.active };
    }),
    // manual status change: respect it, never auto-revert that row later
    setItemStatus: (key, s) => patchProject(get().settings.currentProject, p => ({
      ...p,
      items: p.items.map(i => (i.key === key ? setStatus(i, s) : i)),
      active: p.active?.key === key ? null : p.active,
    })),
    setItemCollected: (key, n) => patchItem(key, it => setCollected(it, n)),

    addMap(name) {
      const m: GameMap = { id: newId('m'), name: name.trim() || 'Map', ownedFarms: [] };
      set({ maps: [...get().maps, m], selectedMap: m.id });
      schedule(get, set, 'maps');
      return m.id;
    },
    renameMap(id, name) { set({ maps: get().maps.map(m => (m.id === id ? { ...m, name } : m)) }); schedule(get, set, 'maps'); },
    deleteMap(id, moveTo) {
      const keys: string[] = [];
      const projects = { ...get().projects };
      for (const p of Object.values(projects)) {
        if (p.mapId !== id) continue;
        if (moveTo) projects[p.id] = { ...p, mapId: moveTo };
        else delete projects[p.id];
        keys.push(`p:${p.id}`);
      }
      const maps = get().maps.filter(m => m.id !== id);
      set({ maps, projects, selectedMap: maps[0]?.id ?? null });
      const cur = get().settings.currentProject;
      if (cur && !projects[cur]) get().setSettings({ currentProject: Object.keys(projects)[0] ?? null });
      schedule(get, set, 'maps', ...keys);
    },
    toggleFarm(mapId, farmId) {
      set({
        maps: get().maps.map(m => (m.id !== mapId ? m : {
          ...m, ownedFarms: m.ownedFarms.includes(farmId) ? m.ownedFarms.filter(f => f !== farmId) : [...m.ownedFarms, farmId],
        })),
      });
      schedule(get, set, 'maps');
    },

    setItemNote(mapId, key, text) {
      set({ maps: get().maps.map(m => {
        if (m.id !== mapId) return m;
        const itemNotes = { ...(m.itemNotes ?? {}) };
        if (text.trim()) itemNotes[key] = text.trim(); else delete itemNotes[key];
        return { ...m, itemNotes };
      }) });
      schedule(get, set, 'maps');
    },
    setFarmNote(mapId, farmId, text) {
      set({ maps: get().maps.map(m => {
        if (m.id !== mapId) return m;
        const farmNotes = { ...(m.farmNotes ?? {}) };
        if (text.trim()) farmNotes[farmId] = text.trim(); else delete farmNotes[farmId];
        return { ...m, farmNotes };
      }) });
      schedule(get, set, 'maps');
    },
    async openMini() {
      // save first: the mini window loads its data from disk
      set({ busy: 'saving' });
      try {
        await flushNow();
        await wait(get().bootAnim === 'off' ? 0 : 350);
        const s = get().settings, b = s.miniBounds;
        const w = b?.w ?? 340, h = b?.h ?? 460;
        await io.openMini({ x: b?.x ?? Math.max(0, screen.availWidth - w - 24), y: b?.y ?? 48, w, h, onTop: s.miniOnTop, hideMain: s.hideMainOnMini });
      } finally {
        set({ busy: null });
      }
    },

    classify(rawName, o) {
      const { rawDb } = get();
      if (!rawDb) return;
      const overrides: UserOverrides = structuredClone(rawDb.overrides ?? { items: {}, groups: [] });
      let groupId = o.group;
      if (o.newGroup) {
        groupId = `user_${slug(o.newGroup.en) || newId('g')}`;
        const g: DbGroup = {
          id: groupId, en: o.newGroup.en, vi: o.newGroup.en, farms: o.newGroup.farms, derived: false, base: [],
          howTo: o.newGroup.farms.length ? null : { en: o.newGroup.howTo, vi: o.newGroup.howTo },
        };
        overrides.groups = [...overrides.groups.filter(x => x.id !== g.id), g];
      }
      const id = `custom:${slug(rawName)}`;
      overrides.items[id] = { name: rawName, group: groupId, vi: o.vi || undefined, stack: o.stack || undefined };
      const nextRaw = { ...rawDb, overrides };
      const db = buildDb(nextRaw);
      const projects: Record<string, Project> = {};
      const keys: string[] = [];
      for (const p of Object.values(get().projects)) {
        const np = reresolve(db, p);
        projects[p.id] = np;
        if (np !== p) keys.push(`p:${p.id}`);
      }
      set({ rawDb: nextRaw, db, projects });
      schedule(get, set, 'overrides', ...keys);
    },

    exportAll() {
      const s = get();
      return JSON.stringify({
        app: 'mtr-check-list', version: 1, exportedAt: new Date().toISOString(),
        settings: s.settings, maps: s.maps, projects: Object.values(s.projects), overrides: s.db?.overrides,
      }, null, 1);
    },
    importAll(json) {
      const b = JSON.parse(json);
      if (b?.app !== 'mtr-check-list' || !Array.isArray(b.maps) || !Array.isArray(b.projects)) throw new Error('File sao lưu không hợp lệ');
      const old = Object.keys(get().projects);
      let rawDb = get().rawDb!;
      if (b.overrides) rawDb = { ...rawDb, overrides: b.overrides };
      const db = buildDb(rawDb);
      const projects: Record<string, Project> = {};
      for (const p of b.projects as Project[]) projects[p.id] = reresolve(db, p);
      set({ maps: b.maps, projects, rawDb, db, settings: { ...get().settings, ...b.settings }, selectedMap: b.maps[0]?.id ?? null });
      schedule(get, set, 'maps', 'settings', 'overrides', ...old.map(id => `p:${id}`), ...Object.keys(projects).map(id => `p:${id}`));
    },
  };
});
