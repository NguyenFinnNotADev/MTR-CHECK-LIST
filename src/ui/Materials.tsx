import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { tweenNumber } from './motion';
import { farmName, groupName, itemName } from '../core/db';
import { formatQty, num, shulkers } from '../core/format';
import { isCraftable, rawMaterials, rawTree, type RawNode } from '../core/raw';
import { missingQty, progress } from '../core/state';
import type { Db, GameMap, Lang, Project, ProjectItem, SortMode, Status } from '../core/types';
import { buildView, groupRawTotals, type ViewGroup } from '../core/view';
import { t } from '../i18n';
import { useStore } from '../store';
import { ClassifyDialog, Confirm, Dialog, Prompt } from './Dialogs';
import { Icon, Slot, UiIcon } from './Icon';

const stackOf = (db: Db, key: string) => db.items.get(key)?.stack ?? 64;

export function Materials({ project }: { project: Project }) {
  const { db, maps, settings, search, setSearch, setSettings, openMini } = useStore();
  const lang = settings.lang;
  const map = maps.find(m => m.id === project.mapId);
  const view = useMemo(
    () => buildView(db!, project, map, { sort: settings.sort, reverse: settings.reverse, lang, search, filter: settings.statusFilter }),
    [db, project, map, settings.sort, settings.reverse, lang, search, settings.statusFilter],
  );
  const [classify, setClassify] = useState<string | null>(null);
  const pr = view.totalTypes ? view.doneTypes / view.totalTypes : 0;
  const sorts: [SortMode, Parameters<typeof t>[1]][] = [['farm', 'sortFarm'], ['qty', 'sortQty'], ['name', 'sortName']];
  const filters: (Status | 'all')[] = ['all', 'none', 'collecting', 'done'];
  const empty = !view.missing.farmable.length && !view.missing.nonFarmable.length && !view.missing.unclassified.length && !view.owned.length;

  return (
    <>
      <header className="top">
        <h1 title={project.name}>{project.name}</h1>
        <span className="pill">{map?.name ?? '—'}</span>
        <div className="prog">{view.doneTypes} / {view.totalTypes} {t(lang, 'types')}<div className="bar"><i style={{ width: `${pr * 100}%` }} /></div>{Math.round(pr * 100)}%</div>
        <button className="btn" onClick={() => void openMini()}><UiIcon name="mini" />{t(lang, 'miniBtn')}</button>
        <ProjectMenu project={project} />
      </header>
      <div className="tools">
        <label className="searchbox"><UiIcon name="search" size={16} />
          <input placeholder={t(lang, 'search')} value={search} onChange={e => setSearch(e.target.value)} /></label>
        <div className="seg">
          {sorts.map(([m, k]) => <button key={m} className={settings.sort === m ? 'on' : ''} onClick={() => setSettings({ sort: m })}>{t(lang, k)}</button>)}
        </div>
        <button className={`btn ${settings.reverse ? 'on' : ''}`} title={t(lang, 'reverse')} onClick={() => setSettings({ reverse: !settings.reverse })}>⇅</button>
        <div className="seg">
          {filters.map(f => <button key={f} className={settings.statusFilter === f ? 'on' : ''} onClick={() => setSettings({ statusFilter: f })}>{t(lang, f)}</button>)}
        </div>
        <div className="seg" style={{ marginLeft: 'auto' }}>
          {(['en', 'vi', 'duo'] as Lang[]).map(l => <button key={l} className={lang === l ? 'on' : ''} onClick={() => setSettings({ lang: l })}>{l === 'en' ? 'EN' : l === 'vi' ? 'VI' : 'Duo'}</button>)}
        </div>
      </div>
      <div className="scroll">
        {empty && <div className="empty"><p>{t(lang, 'noResults')}</p></div>}
        {(view.missing.farmable.length > 0 || view.missing.nonFarmable.length > 0 || view.missing.unclassified.length > 0) && (
          <div className="zone"><UiIcon name="pickaxe" size={24} />{t(lang, 'zoneMissing')} <em>{view.visibleMissingTypes} {t(lang, 'types')} · {num(view.visibleMissingQty)} {t(lang, 'blocks')}</em></div>
        )}
        {view.missing.farmable.length > 0 && <div className="sub"><UiIcon name="plan" size={16} />{t(lang, 'farmable')}</div>}
        {view.missing.farmable.map(g => <GroupCard key={g.key} g={g} map={map} />)}
        {view.missing.nonFarmable.length > 0 && <div className="sub"><UiIcon name="nonfarm" size={16} />{t(lang, 'nonFarmable')}</div>}
        {view.missing.nonFarmable.map(g => <GroupCard key={g.key} g={g} map={map} />)}
        {view.missing.unclassified.length > 0 && (
          <>
            <div className="sub"><UiIcon name="unknown" size={16} />{t(lang, 'unclassified')}</div>
            <div className="group">
              {view.missing.unclassified.map(it => (
                <div key={it.key} className="row" style={{ cursor: 'default' }}>
                  <Slot id={it.key} name={it.name} />
                  <div className="nm"><b>{it.name}</b></div>
                  <div className="qty">{num(it.total)}</div>
                  <div className="st"><button className="btn" onClick={() => setClassify(it.name)}>{t(lang, 'classify')}</button></div>
                </div>
              ))}
            </div>
          </>
        )}
        {view.owned.length > 0 && <OwnedZone groups={view.owned} count={view.ownedCount} map={map} />}
      </div>
      {classify && <ClassifyDialog rawName={classify} onClose={() => setClassify(null)} />}
    </>
  );
}

function OwnedZone({ groups, count, map }: { groups: ViewGroup[]; count: number; map?: GameMap }) {
  const { settings, setSettings } = useStore();
  const lang = settings.lang;
  const collapsed = settings.ownedCollapsed;
  const sample = groups.flatMap(g => g.items).slice(0, 8);
  return (
    <>
      <div className="ownedbar" onClick={() => setSettings({ ownedCollapsed: !collapsed })}>
        <UiIcon name="owned" size={22} />{t(lang, 'zoneOwned')} · {count} {t(lang, 'types')}
        <div className="ics">{sample.map(i => <Icon key={i.key} id={i.key} name={i.name} />)}</div>
        <span className="tl">{collapsed ? `${t(lang, 'expand')} ▸` : `${t(lang, 'collapse')} ▾`}</span>
      </div>
      {!collapsed && <div className="owned-zone" style={{ display: 'contents' }}>{groups.map(g => <GroupCard key={`o-${g.key}`} g={g} map={map} owned />)}</div>}
    </>
  );
}

function ProjectMenu({ project }: { project: Project }) {
  const { settings, maps, renameProject, moveProject, duplicate, reset, deleteProject } = useStore();
  const lang = settings.lang;
  const [open, setOpen] = useState(false);
  const [dlg, setDlg] = useState<null | 'rename' | 'reset' | 'delete' | 'move' | 'history'>(null);
  const go = (d: typeof dlg) => { setOpen(false); setDlg(d); };
  return (
    <div className="menu">
      <button className="btn" onClick={() => setOpen(!open)} aria-label="menu">⋯</button>
      {open && (
        <div className="menu-list" onMouseLeave={() => setOpen(false)}>
          <button onClick={() => go('history')}><UiIcon name="history" />{t(lang, 'history')}</button>
          <button onClick={() => go('rename')}><UiIcon name="rename" />{t(lang, 'rename')}</button>
          <button onClick={() => go('move')}><UiIcon name="maps" />{t(lang, 'changeMap')}</button>
          <button onClick={() => { setOpen(false); duplicate(project.id); }}><UiIcon name="duplicate" />{t(lang, 'duplicate')}</button>
          <button onClick={() => go('reset')}><UiIcon name="reset" />{t(lang, 'reset')}</button>
          <button onClick={() => go('delete')} style={{ color: '#c0392b' }}><UiIcon name="delete" />{t(lang, 'delete')}</button>
        </div>
      )}
      {dlg === 'history' && <HistoryDialog project={project} onClose={() => setDlg(null)} />}
      {dlg === 'rename' && <Prompt lang={lang} title={t(lang, 'rename')} initial={project.name} onOk={v => renameProject(project.id, v)} onClose={() => setDlg(null)} />}
      {dlg === 'reset' && <Confirm lang={lang} text={t(lang, 'confirmReset')} yes={t(lang, 'reset')} onYes={() => reset(project.id)} onClose={() => setDlg(null)} />}
      {dlg === 'delete' && <Confirm lang={lang} text={t(lang, 'confirmDeleteProject')} onYes={() => deleteProject(project.id)} onClose={() => setDlg(null)} />}
      {dlg === 'move' && (
        <Dialog title={t(lang, 'changeMap')} onClose={() => setDlg(null)}>
          {maps.map(m => (
            <button key={m.id} className={`btn ${m.id === project.mapId ? 'on' : ''}`} onClick={() => { moveProject(project.id, m.id); setDlg(null); }}>{m.name}</button>
          ))}
          <div className="acts"><button className="btn" onClick={() => setDlg(null)}>{t(lang, 'cancel')}</button></div>
        </Dialog>
      )}
    </div>
  );
}

const GroupCard = memo(function GroupCard({ g, map, owned }: { g: ViewGroup; map?: GameMap; owned?: boolean }) {
  const { db, settings, openGroups, toggleGroup, toggleFarm } = useStore();
  const lang = settings.lang;
  const name = groupName(g.group, lang);
  const derived = g.group.derived;
  const hasRaw = g.items.some(i => isCraftable(db!, i.key));
  const open = !!openGroups[(owned ? 'o-' : '') + g.key];
  return (
    <section className="group">
      <div className="ghead" onClick={() => hasRaw && toggleGroup((owned ? 'o-' : '') + g.key)} title={hasRaw ? t(lang, 'groupRaw') : undefined}>
        {hasRaw && <span className={`chev ${open ? 'open' : ''}`}>▸</span>}
        <b>{name.main}</b>
        {name.sub && <span className="gsub">{name.sub}</span>}
        {g.farmable && derived && g.farms.length > 2 ? (
          <span className={`farm ${g.ownedFarms.length === g.farms.length ? 'ok' : ''}`}
            title={g.farms.map(fid => { const f = db!.farms.get(fid); return `${map?.ownedFarms.includes(fid) ? '✔ ' : '• '}${f ? farmName(f, lang) : fid}`; }).join('\n')}>
            <UiIcon name="group" size={14} />{t(lang, 'byRawMaterials')} · {g.ownedFarms.length}/{g.farms.length} farm
          </span>
        ) : g.farmable ? g.farms.map(fid => {
          const f = db!.farms.get(fid);
          if (!f) return null;
          const has = map?.ownedFarms.includes(fid);
          return (
            <button key={fid} className={`farm ${has ? 'ok' : ''}`} title={map?.farmNotes?.[fid] ? `📍 ${map.farmNotes[fid]}` : map?.name}
              onClick={e => { e.stopPropagation(); if (map) toggleFarm(map.id, fid); }}>
              {has && <UiIcon name="owned" size={14} />}{farmName(f, lang)}{has ? ` · ${t(lang, 'owned')}` : ''}
            </button>
          );
        }) : (
          <>
            <span className="farm no"><UiIcon name="nofarm" size={14} />{t(lang, 'noFarm')}</span>
            {!derived && g.group.howTo && <span className="howto">{lang === 'en' ? g.group.howTo.en : g.group.howTo.vi}</span>}
          </>
        )}
        <span className="cnt">{g.items.length} {t(lang, 'types')} · {num(g.totalQty)}</span>
      </div>
      {open && <GroupRaw items={g.items} />}
      {g.items.map((it, i) => <ItemRow key={it.key} it={it} map={map} idx={i} />)}
    </section>
  );
});

function GroupRaw({ items }: { items: ProjectItem[] }) {
  const { db, settings } = useStore();
  const lang = settings.lang;
  const { need, miss } = useMemo(() => groupRawTotals(db!, items), [db, items]);
  const totalNeed = [...need.values()].reduce((a, b) => a + b, 0);
  const totalMiss = [...miss.values()].reduce((a, b) => a + b, 0);
  const pct = totalNeed ? 1 - totalMiss / totalNeed : 1;
  return (
    <div className="gtotal">
      <span className="gl"><UiIcon name="raw" size={16} />{t(lang, 'groupRaw')}</span>
      {[...need].sort((a, b) => b[1] - a[1]).map(([id, n]) => {
        const nm = itemName(db!, id, id, lang).main;
        const m = miss.get(id) ?? 0;
        return (
          <span key={id} className="chip">
            <Icon id={id} name={nm} />{num(n)} {nm}
            <small>· {t(lang, 'stillMissing')} {num(m)}{shulkers(m, stackOf(db!, id)) >= 0.1 ? ` ≈ ${shulkers(m, stackOf(db!, id))} shulker` : ''}</small>
          </span>
        );
      })}
      <span className="pb"><i style={{ width: `${pct * 100}%` }} /></span><span className="muted">{Math.round(pct * 100)}%</span>
    </div>
  );
}

const ItemRow = memo(function ItemRow({ it, map, idx = 0 }: { it: ProjectItem; map?: GameMap; idx?: number }) {
  const { db, settings, clickItem, setItemStatus, setItemNote } = useStore();
  const celebrate = useStore(s => s.justDone?.key === it.key && Date.now() - s.justDone.at < 1500);
  const lang = settings.lang;
  const [editNote, setEditNote] = useState(false);
  const name = itemName(db!, it.key, it.name, lang);
  const stack = stackOf(db!, it.key);
  const sub = formatQty(it.total, stack);
  const statuses: Status[] = ['none', 'collecting', 'done'];
  const note = map?.itemNotes?.[it.key];
  return (
    <div className={`row ${it.status} ${celebrate ? 'celebrate' : ''}`} style={{ '--i': Math.min(idx, 16) } as React.CSSProperties} onClick={() => clickItem(it.key)}>
      <div className="slotwrap"><Slot id={it.key} name={it.name} />{celebrate && <span className="burst">{Array.from({ length: 8 }, (_, k) => <i key={k} />)}</span>}</div>
      <div className="nm">
        <b title={name.main}>{name.main}
          {map && <button className={`notebtn ${note ? 'has' : ''}`} title={t(lang, 'itemNoteTitle')}
            onClick={e => { e.stopPropagation(); setEditNote(true); }}><UiIcon name="note" size={14} /></button>}
        </b>
        {name.sub && <small>{name.sub}</small>}
        {note && <small className="note"><UiIcon name="note" size={12} />{note}</small>}
        {editNote && map && (
          <span onClick={e => e.stopPropagation()}>
            <Prompt lang={lang} title={`${t(lang, 'itemNoteTitle')} · ${name.main}`} initial={note ?? ''} allowEmpty
              onOk={v => setItemNote(map.id, it.key, v)} onClose={() => setEditNote(false)} />
          </span>
        )}
      </div>
      <div className="qty">{num(it.total)}{sub && <small>{sub}</small>}</div>
      <div className="st" onClick={e => e.stopPropagation()}>
        {statuses.map(s => (
          <button key={s} className={`${s} ${it.status === s ? 'on' : ''}`} onClick={() => setItemStatus(it.key, s)}>{t(lang, s)}</button>
        ))}
      </div>
      {it.status === 'collecting' && <CollectPanel it={it} stack={stack} />}
    </div>
  );
});

/** Big number: bumps on change (lite); counts up/down smoothly (full). */
function CountUp({ value }: { value: number }) {
  const full = useStore(s => s.bootAnim) === 'full';
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (!full) { setShown(value); prev.current = value; return; }
    const from = prev.current;
    prev.current = value;
    return tweenNumber(from, value, 380, setShown);
  }, [value, full]);
  return <b key={full ? undefined : value} className="bump">{num(full ? shown : value)}</b>;
}

/** Expanded panel for a collecting row: progress card (left) + raw materials table (right). */
function CollectPanel({ it, stack }: { it: ProjectItem; stack: number }) {
  const { db, settings, setItemCollected } = useStore();
  const lang = settings.lang;
  const [draft, setDraft] = useState<string | null>(null);
  const p = progress(it);
  const miss = missingQty(it);
  const craftable = isCraftable(db!, it.key);
  const commit = (v: string) => { const n = parseInt(v.replace(/\s/g, ''), 10); if (!Number.isNaN(n)) setItemCollected(it.key, n); setDraft(null); };
  const add = (n: number) => setItemCollected(it.key, Math.max(0, it.collected + n));
  const sh = shulkers(miss, stack);
  return (
    <div className="cpanel" onClick={e => e.stopPropagation()}>
      <div className="ccard prog-card">
        <h4>{t(lang, 'progress')}</h4>
        <div className="big"><CountUp value={it.collected} /><span>/ {num(it.total)}</span><em>{Math.round(p * 100)}%</em></div>
        <div className="pb"><i style={{ width: `${p * 100}%` }} /></div>
        <div className="ctl">
          <button onClick={() => add(-stack)}>−{stack}</button>
          <input type="text" inputMode="numeric" aria-label={t(lang, 'collected')} value={draft ?? String(it.collected)}
            onChange={e => setDraft(e.target.value.replace(/[^\d\s]/g, ''))}
            onBlur={e => commit(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                add((e.shiftKey ? stack : 1) * (e.key === 'ArrowUp' ? 1 : -1));
                setDraft(null);
              }
            }} />
          <button onClick={() => add(stack)}>+{stack}</button>
          <button onClick={() => add(27 * stack)}>{t(lang, 'shulkerBtn')}</button>
        </div>
        <div className="hint">{t(lang, 'stillMissing')} {num(miss)}{sh >= 0.1 ? ` · ≈ ${sh} shulker` : ''}</div>
      </div>
      {craftable && (
        <div className="ccard raw-card">
          <h4><UiIcon name="raw" size={16} />{t(lang, 'rawMaterials')}</h4>
          <RawTable id={it.key} total={it.total} missing={miss} lang={lang} />
        </div>
      )}
    </div>
  );
}

/**
 * Raw materials as an aligned table (F-pattern: names left, numbers right-aligned, tabular).
 * Many base materials wrap into two column groups; intermediate steps listed once underneath.
 */
export function RawTable({ id, total, missing, lang, compact }: { id: string; total: number; missing: number; lang: Lang; compact?: boolean }) {
  const { db } = useStore();
  const { need, miss, mids } = useMemo(() => {
    const tree = rawTree(db!, id, total);
    const leafs = new Map<string, number>();
    const mid = new Map<string, number>();
    const walk = (n: RawNode, root: boolean) => {
      if (!n.children.length) { leafs.set(n.id, (leafs.get(n.id) ?? 0) + n.qty); return; }
      if (!root) mid.set(n.id, (mid.get(n.id) ?? 0) + n.qty);
      n.children.forEach(c => walk(c, false));
    };
    walk(tree, true);
    return { need: [...leafs].sort((a, b) => b[1] - a[1]), miss: rawMaterials(db!, id, missing), mids: [...mid] };
  }, [db, id, total, missing]);
  const nm = (k: string) => itemName(db!, k, k, lang).main;
  const wide = !compact && need.length > 4;
  const head = (
    <>
      <span className="rh">{t(lang, 'material')}</span><span className="rh">{t(lang, 'need')}</span><span className="rh">{t(lang, 'stillMissing')}</span>
    </>
  );
  return (
    <>
      <div className={`rawgrid ${wide ? 'wide' : ''}`}>
        {head}{wide && head}
        {need.map(([k, n]) => {
          const m = miss.get(k) ?? 0;
          return (
            <span key={k} style={{ display: 'contents' }}>
              <span className="rn"><Icon id={k} name={nm(k)} /><span title={nm(k)}>{nm(k)}</span></span>
              <span className="rv">{num(n)}</span>
              <span className={`rv ${m ? 'miss' : 'ok'}`}>{m ? num(m) : '✔'}</span>
            </span>
          );
        })}
      </div>
      {mids.length > 0 && (
        <div className="via">{t(lang, 'via')}:
          {mids.slice(0, 6).map(([k, n]) => <span key={k} className="vchip"><Icon id={k} name={nm(k)} />{num(n)} {nm(k)}</span>)}
        </div>
      )}
    </>
  );
}

function HistoryDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const { settings } = useStore();
  const lang = settings.lang;
  const h = project.history ?? [];
  const W = 560, H = 200, P = 34;
  const xs = (i: number) => P + (h.length > 1 ? (i / (h.length - 1)) * (W - 2 * P) : (W - 2 * P) / 2);
  const ys = (v: number) => H - P - v * (H - 2 * P);
  const pts = h.map((p, i) => `${xs(i)},${ys(p.totalTypes ? p.doneTypes / p.totalTypes : 0)}`).join(' ');
  return (
    <Dialog title={`${t(lang, 'history')} · ${project.name}`} icon="history" onClose={onClose}>
      {!h.length ? <p className="muted">{t(lang, 'historyEmpty')}</p> : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="hist">
            {[0, 0.25, 0.5, 0.75, 1].map(v => (
              <g key={v}><line x1={P} x2={W - P} y1={ys(v)} y2={ys(v)} className="grid" /><text x={2} y={ys(v) + 4}>{v * 100}%</text></g>
            ))}
            <polyline points={pts} className="line" />
            {h.map((p, i) => <circle key={p.date} cx={xs(i)} cy={ys(p.totalTypes ? p.doneTypes / p.totalTypes : 0)} r={4} className="dot"><title>{p.date}</title></circle>)}
          </svg>
          <table className="htable">
            <thead><tr><th>{t(lang, 'date')}</th><th>{t(lang, 'doneTypesCol')}</th><th>%</th><th>{t(lang, 'missingCol')}</th></tr></thead>
            <tbody>
              {[...h].reverse().map(p => (
                <tr key={p.date}><td>{p.date}</td><td className="n">{p.doneTypes} / {p.totalTypes}</td><td className="n">{p.totalTypes ? Math.round((p.doneTypes / p.totalTypes) * 100) : 0}%</td><td className="n">{num(p.missingQty)}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <div className="acts"><button className="btn" onClick={onClose}>{t(lang, 'close')}</button></div>
    </Dialog>
  );
}
