import { useEffect, useMemo, useState } from 'react';
import { groupName, itemName } from '../core/db';
import { num } from '../core/format';
import { isCraftable } from '../core/raw';
import { missingQty, progress } from '../core/state';
import type { DbGroup, GameMap, ProjectItem } from '../core/types';
import { t } from '../i18n';
import * as io from '../platform';
import { useStore } from '../store';
import { RawTable } from './Materials';
import { Icon, UiIcon } from './Icon';

const hexToRgba = (hex: string, a: number) => {
  const h = hex.trim().replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
// The window compositor makes partial alpha look much more see-through than the number says;
// a square-root curve makes the slider feel linear.
const perceived = (v: number) => Math.sqrt(Math.min(1, Math.max(0, v)));

interface MiniGroup { g: DbGroup; collecting: ProjectItem[]; others: ProjectItem[] }

export function Mini() {
  const { db, projects, maps, settings, setSettings, selectProject } = useStore();
  const lang = settings.lang;
  const project = settings.currentProject ? projects[settings.currentProject] : undefined;
  const map = maps.find(m => m.id === project?.mapId);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [showOther, setShowOther] = useState(false);

  // translucent background following theme + opacity (theme applied first so --bg is correct)
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg') || '#f3e9d7';
    document.documentElement.style.background = 'transparent';
    document.body.style.background = hexToRgba(bg, perceived(settings.miniOpacity));
  }, [settings.miniOpacity, settings.theme]);
  useEffect(() => { void io.setOnTop(settings.miniOnTop); }, [settings.miniOnTop]);
  useEffect(() => {
    let h: ReturnType<typeof setTimeout> | null = null;
    void io.watchBounds(b => { if (h) clearTimeout(h); h = setTimeout(() => useStore.getState().setSettings({ miniBounds: b }), 600); });
  }, []);

  const { active, rest } = useMemo(() => {
    if (!project || !db) return { active: [] as MiniGroup[], rest: [] as MiniGroup[] };
    const by = new Map<string, MiniGroup>();
    for (const it of project.items) {
      const d = db.items.get(it.key);
      const g = d ? db.groups.get(d.group) : undefined;
      if (!g) continue;
      let e = by.get(g.id);
      if (!e) { e = { g, collecting: [], others: [] }; by.set(g.id, e); }
      if (it.status === 'collecting') e.collecting.push(it);
      else if (it.status === 'none') e.others.push(it);
    }
    const all = [...by.values()].map(e => ({ ...e, others: e.others.sort((a, b) => b.total - a.total) }));
    return {
      active: all.filter(e => e.collecting.length),
      rest: all.filter(e => !e.collecting.length && e.others.length).sort((a, b) => b.others.length - a.others.length),
    };
  }, [db, project]);

  const projList = Object.values(projects).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const otherOpen = showOther || active.length === 0;

  const groupCard = ({ g, collecting, others }: MiniGroup) => {
    const open = !!openGroups[g.id];
    return (
      <section key={g.id} className="mini-group">
        <div className="mini-ghead">
          <b>{groupName(g, lang).main}</b>
          {others.length > 0 && (
            <button className="btn" onClick={() => setOpenGroups({ ...openGroups, [g.id]: !open })}>
              {open ? '▾' : '▸'} {collecting.length ? t(lang, 'sameGroup') : t(lang, 'none')} ({others.length})
            </button>
          )}
        </div>
        {collecting.map(it => <MiniItem key={it.key} it={it} map={map} />)}
        {open && others.map(it => (
          <button key={it.key} className="mini-other" onClick={() => useStore.getState().clickItem(it.key)}>
            <Icon id={it.key} name={it.name} />
            <span>{itemName(db!, it.key, it.name, lang).main}</span>
            <em>{num(it.total)}</em>
          </button>
        ))}
      </section>
    );
  };

  return (
    <div className="mini">
      <div className="mini-top">
        <select value={settings.currentProject ?? ''} onChange={e => selectProject(e.target.value)}>
          {projList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className={`btn ${settings.miniOnTop ? 'on' : ''}`} title={t(lang, 'onTop')} onClick={() => setSettings({ miniOnTop: !settings.miniOnTop })}><UiIcon name="pin" /></button>
        <input type="range" min={0.35} max={1} step={0.05} value={settings.miniOpacity} title={`${t(lang, 'opacity')} ${Math.round(settings.miniOpacity * 100)}%`}
          onChange={e => setSettings({ miniOpacity: Number(e.target.value) })} />
        <button className="btn" title={t(lang, 'miniMain')} onClick={() => void io.showMain()}><UiIcon name="main" /></button>
      </div>
      <div className="mini-list">
        {!active.length && <p className="muted mini-empty">{t(lang, 'miniEmpty')}</p>}
        {active.map(groupCard)}
        {rest.length > 0 && (
          <>
            <button className="mini-section" onClick={() => setShowOther(!showOther)}>
              {otherOpen ? '▾' : '▸'} {t(lang, 'otherGroups')} ({rest.length})
            </button>
            {otherOpen && rest.map(groupCard)}
          </>
        )}
      </div>
    </div>
  );
}

function MiniItem({ it, map }: { it: ProjectItem; map?: GameMap }) {
  const { db, settings, setItemCollected, setItemStatus } = useStore();
  const lang = settings.lang;
  const [draft, setDraft] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const stack = db!.items.get(it.key)?.stack ?? 64;
  const p = progress(it);
  const craftable = isCraftable(db!, it.key);
  const note = map?.itemNotes?.[it.key];
  const commit = (v: string) => { const n = parseInt(v.replace(/\s/g, ''), 10); if (!Number.isNaN(n)) setItemCollected(it.key, n); setDraft(null); };
  return (
    <div className="mini-item">
      <div className="mini-row">
        <Icon id={it.key} name={it.name} />
        <div className="mini-nm">
          <b>{itemName(db!, it.key, it.name, lang).main}</b>
          {note && <small className="mini-note"><UiIcon name="note" size={12} />{note}</small>}
          <div className="pb"><i style={{ width: `${p * 100}%` }} /></div>
        </div>
        <span className="mini-qty"><span key={it.collected} className="bumpable">{num(it.collected)}</span><small>/ {num(it.total)}</small></span>
      </div>
      <div className="mini-ctl">
        <input type="text" inputMode="numeric" value={draft ?? String(it.collected)}
          onChange={e => setDraft(e.target.value.replace(/[^\d\s]/g, ''))}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit((e.target as HTMLInputElement).value); }} />
        <button onClick={() => setItemCollected(it.key, it.collected + stack)}>+{stack}</button>
        <button title={t(lang, 'shulkerBtn')} onClick={() => setItemCollected(it.key, it.collected + 27 * stack)}>+1 Shulker</button>
        {craftable && <button className={showRaw ? 'on' : ''} title={t(lang, 'showRaw')} onClick={() => setShowRaw(!showRaw)}><UiIcon name="raw" size={14} /></button>}
        <button className="done" onClick={() => setItemStatus(it.key, 'done')}>✔ {t(lang, 'done')}</button>
      </div>
      {showRaw && craftable && <RawTable id={it.key} total={it.total} missing={missingQty(it)} lang={lang} compact />}
    </div>
  );
}
