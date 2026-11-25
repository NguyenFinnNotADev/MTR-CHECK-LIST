import { useMemo, useState } from 'react';
import { farmName, itemName } from '../core/db';
import { num, shulkers } from '../core/format';
import { buildFarmPlan, type FarmPlan } from '../core/plan';
import { t } from '../i18n';
import { useStore } from '../store';
import { Icon, Slot, UiIcon } from './Icon';

export function PlanTab() {
  const { db, maps, projects, settings, selectedMap, selectMap, toggleFarm, setFarmNote, selectProject } = useStore();
  const lang = settings.lang;
  const curMapId = settings.currentProject ? projects[settings.currentProject]?.mapId : undefined;
  const map = maps.find(m => m.id === (selectedMap ?? curMapId)) ?? maps.find(m => m.id === curMapId) ?? maps[0];
  const plans = useMemo(() => (map ? buildFarmPlan(db!, Object.values(projects), map) : []), [db, projects, map]);
  const suggest = plans.filter(p => !p.owned);
  const byFarm = [...plans].sort((a, b) => Number(b.owned) - Number(a.owned) || b.units - a.units);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  if (!map) return null;
  const nm = (id: string) => itemName(db!, id, id, lang).main;
  const iconOf = (p: FarmPlan) => [...p.raw.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'barrier';

  return (
    <div className="page" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div className="tools" style={{ padding: 0 }}>
        <span className="muted" style={{ fontWeight: 800 }}>{t(lang, 'map')}:</span>
        <div className="seg">
          {maps.map(m => <button key={m.id} className={m.id === map.id ? 'on' : ''} onClick={() => selectMap(m.id)}>{m.name}</button>)}
        </div>
      </div>

      {!plans.length && <div className="card"><p className="muted">{t(lang, 'planEmpty')}</p></div>}

      {suggest.length > 0 && (
        <div className="card">
          <h2><UiIcon name="build" size={24} />{t(lang, 'planSuggest')}</h2>
          <p className="muted" style={{ marginTop: 0 }}>{t(lang, 'planSuggestHint')}</p>
          <div className="suggest">
            {suggest.slice(0, 12).map((p, i) => {
              const f = db!.farms.get(p.farmId);
              return (
                <div key={p.farmId} className="sugrow">
                  <span className="rank">{i + 1}</span>
                  <Slot id={iconOf(p)} name={f?.en ?? p.farmId} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b>{f ? farmName(f, lang) : p.farmId}</b>
                    <small>{num(p.units)} {t(lang, 'units')} · {p.items.length} {t(lang, 'types')} · {p.projects.size} {t(lang, 'buildsN')}</small>
                  </div>
                  <div className="sugbar"><i style={{ width: `${(p.units / suggest[0].units) * 100}%` }} /></div>
                  <button className="btn" onClick={() => toggleFarm(map.id, p.farmId)}>＋ {t(lang, 'markOwned')}</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {byFarm.length > 0 && <div className="sub"><UiIcon name="plan" size={16} />{t(lang, 'planByFarm')}</div>}
      {byFarm.map(p => {
        const f = db!.farms.get(p.farmId);
        const isOpen = !!open[p.farmId];
        const note = map.farmNotes?.[p.farmId] ?? '';
        return (
          <section key={p.farmId} className="group">
            <div className="ghead" onClick={() => setOpen({ ...open, [p.farmId]: !isOpen })}>
              <span className={`chev ${isOpen ? 'open' : ''}`}>▸</span>
              <b>{f ? farmName(f, lang) : p.farmId}</b>
              {p.owned ? <span className="farm ok">{t(lang, 'ownedFarm')}</span> : <span className="farm">{t(lang, 'owned')}?</span>}
              {note && <span className="howto"><UiIcon name="location" size={14} /> {note}</span>}
              <span className="cnt">{num(p.units)} {t(lang, 'units')} · {p.items.length} {t(lang, 'types')} · {p.projects.size} {t(lang, 'buildsN')}</span>
            </div>
            <div className="gtotal">
              {[...p.raw].sort((a, b) => b[1] - a[1]).map(([id, n]) => (
                <span key={id} className="chip"><Icon id={id} name={nm(id)} />{num(n)} {nm(id)}{shulkers(n, db!.items.get(id)?.stack ?? 64) >= 0.1 && <small>≈ {shulkers(n, db!.items.get(id)?.stack ?? 64)} shulker</small>}</span>
              ))}
            </div>
            {isOpen && (
              <div className="planbody">
                <label className="farmnote" onClick={e => e.stopPropagation()}>
                  <UiIcon name="location" /> <input type="text" placeholder={t(lang, 'farmNotePh')} defaultValue={note}
                    onBlur={e => setFarmNote(map.id, p.farmId, e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                </label>
                {p.items.sort((a, b) => b.missing - a.missing).map(it => (
                  <div key={`${it.projectId}-${it.key}`} className="row" onClick={() => selectProject(it.projectId)}>
                    <Slot id={it.key} name={it.name} />
                    <div className="nm"><b>{itemName(db!, it.key, it.name, lang).main}</b><small>{it.projectName}</small></div>
                    <div className="qty">{num(it.missing)}<small>{t(lang, 'stillMissing')}</small></div>
                    <div />
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
