import { useEffect, useState } from 'react';
import { parseLitematica, type ParsedList } from '../core/parse';
import { t } from '../i18n';
import { closeMiniWindow, isMini, onAppEvent, pickMaterialList, quitApp } from '../platform';
import { flushNow, wait } from '../store';
import { BusyOverlay, hideSplash } from './Busy';
import { installFullMotion } from './motion';
import { Mini } from './Mini';
import { PlanTab } from './PlanTab';
import { useStore } from '../store';
import { ImportDialog } from './Dialogs';
import { Icon, UiIcon } from './Icon';
import { MapsTab } from './MapsTab';
import { Materials } from './Materials';
import { SettingsTab } from './SettingsTab';
import { Sidebar } from './Sidebar';

/** Dev-only: load the sample list with some progress, for screenshots. ?demo&theme=night&lang=vi&tab=maps */
let demoLoaded = false;
async function loadDemo() {
  if (demoLoaded) return;
  demoLoaded = true;
  const s = useStore.getState();
  const q = new URLSearchParams(location.search);
  if (!Object.keys(s.projects).length) {
    const text = await (await fetch('/mtr/sample/material_list_2026-11-24_18.52.58.txt')).text();
    s.importList(parseLitematica(text), '', s.maps[0].id);
    const st = useStore.getState();
    st.toggleFarm(st.maps[0].id, 'tree_spruce');
    st.clickItem('stripped_spruce_wood');
    st.setItemCollected('stripped_spruce_wood', 3520);
    for (const id of ['dirt', 'stone', 'melon', 'flower_pot', 'water_bucket', 'gold_block', 'torch']) st.setItemStatus(id, 'done');
    st.clickItem('lime_wool');
    st.setItemCollected('lime_wool', 2000);
  }
  const p: Record<string, unknown> = {};
  if (q.get('theme')) p.theme = q.get('theme');
  if (q.get('lang')) p.lang = q.get('lang');
  useStore.getState().setSettings(p);
  if (q.get('tab')) useStore.getState().setTab(q.get('tab') as never);
  if (q.get('open')) useStore.getState().toggleGroup(q.get('open')!);
}

export function App() {
  const { ready, error, saveError, settings, projects, tab, init, importList, busy, bootAnim } = useStore();
  const [pending, setPending] = useState<{ parsed: ParsedList; archived?: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const lang = settings.lang;

  useEffect(() => {
    const t0 = performance.now();
    void init().then(() => {
      if (import.meta.env.DEV && location.search.includes('demo')) void loadDemo();
      const anim = useStore.getState().bootAnim;
      const q = import.meta.env.DEV ? new URLSearchParams(location.search).get('anim') : null;
      const level = (q as typeof anim | null) ?? anim;
      document.documentElement.dataset.anim = level;
      if (level === 'full') installFullMotion();
      // keep the splash up a moment so it reads as a screen, not a flicker
      const min = level === 'off' ? 0 : isMini ? 250 : 650;
      setTimeout(() => hideSplash(level === 'off'), Math.max(0, min - (performance.now() - t0)));
    });
  }, [init]);
  useEffect(() => { document.documentElement.dataset.theme = settings.theme; }, [settings.theme]);
  useEffect(() => { if (toast) { const h = setTimeout(() => setToast(null), 4000); return () => clearTimeout(h); } }, [toast]);
  // save-before-close flows (Rust asks, the page saves with a visible screen, then confirms)
  useEffect(() => {
    const pause = () => wait(useStore.getState().bootAnim === 'off' ? 0 : 450);
    void onAppEvent('mtr-quit', async () => {
      if (!isMini) useStore.getState().setBusy('saving');
      await flushNow();
      if (!isMini) { await pause(); await quitApp(); }
    });
    if (isMini) {
      void onAppEvent('mtr-close-mini', async () => {
        useStore.getState().setBusy('saving');
        await flushNow();
        await pause();
        await closeMiniWindow();
      });
    }
  }, []);

  const pick = async () => {
    try {
      const f = await pickMaterialList(settings.materialsDir);
      if (!f) return;
      setPending({ parsed: parseLitematica(f.text, f.fileName), archived: f.archived });
    } catch (e) {
      setToast(`${t(lang, 'parseError')}: ${e instanceof Error ? e.message : e}`);
    }
  };

  if (!ready) return null;
  if (error) return <div className="empty" style={{ height: '100%', justifyContent: 'center' }}><h2>Lỗi</h2><p>{error}</p></div>;

  if (isMini) return <>{<Mini />}{busy && <BusyOverlay kind={busy} lang={lang} />}</>;
  const project = settings.currentProject ? projects[settings.currentProject] : undefined;
  return (
    <div className={`app anim-${bootAnim}`}>
      <Sidebar onPick={pick} />
      <main className="main">
        {tab === 'materials' && (project ? <Materials project={project} /> : (
          <div className="empty">
            <Icon id="writable_book" name="M" />
            <h2>{t(lang, 'emptyTitle')}</h2>
            <p className="muted">{t(lang, 'emptyText')}</p>
            <button className="btn primary big" onClick={pick}><UiIcon name="pick" size={22} />{t(lang, 'pickFile')}</button>
          </div>
        ))}
        {tab === 'plan' && <PlanTab />}
        {tab === 'maps' && <MapsTab />}
        {tab === 'settings' && <SettingsTab />}
      </main>
      {pending && (
        <ImportDialog schematic={pending.parsed.schematic}
          onOk={(name, mapId) => importList(pending.parsed, name, mapId, pending.archived)}
          onClose={() => setPending(null)} />
      )}
      {(toast || saveError) && <div className="toast">{toast ?? `${t(lang, 'saveError')}: ${saveError}`}</div>}
      {busy && <BusyOverlay kind={busy} lang={lang} />}
    </div>
  );
}
