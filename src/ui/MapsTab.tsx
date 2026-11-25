import { useMemo, useState } from 'react';
import { farmName } from '../core/db';
import { t } from '../i18n';
import { useStore } from '../store';
import { Dialog, Prompt } from './Dialogs';
import { Slot, UiIcon } from './Icon';

export function MapsTab() {
  const { db, maps, projects, settings, selectedMap, selectMap, addMap, renameMap, deleteMap, toggleFarm, setFarmNote } = useStore();
  const lang = settings.lang;
  const map = maps.find(m => m.id === selectedMap) ?? maps[0];
  const [dlg, setDlg] = useState<null | 'add' | 'rename' | 'delete'>(null);
  const [moveTo, setMoveTo] = useState<string>('');

  // farm → groups it serves, and an icon item
  const farms = useMemo(() => {
    const serves = new Map<string, string[]>();
    for (const g of db!.groups.values()) for (const f of g.farms) serves.set(f, [...(serves.get(f) ?? []), lang === 'en' ? g.en : g.vi]);
    return [...db!.farms.values()].map(f => {
      const icon = f.produces.find(p => db!.items.has(p)) ?? db!.groups.get([...db!.groups.values()].find(g => g.farms.includes(f.id))?.id ?? '')?.base[0] ?? 'barrier';
      return { f, icon, serves: serves.get(f.id) ?? [] };
    });
  }, [db, lang]);

  const count = (id: string) => Object.values(projects).filter(p => p.mapId === id).length;

  return (
    <div className="page">
      <div className="card maplist">
        <h2>{t(lang, 'maps')}</h2>
        {maps.map(m => (
          <div key={m.id} className={`maprow ${m.id === map?.id ? 'on' : ''}`} onClick={() => selectMap(m.id)}>
            <b title={m.name}>{m.name}</b>
            <span className="muted">{count(m.id)}</span>
            <button title={t(lang, 'rename')} onClick={e => { e.stopPropagation(); selectMap(m.id); setDlg('rename'); }}><UiIcon name="rename" /></button>
            {maps.length > 1 && <button title={t(lang, 'deleteMap')} onClick={e => { e.stopPropagation(); selectMap(m.id); setMoveTo(maps.find(x => x.id !== m.id)!.id); setDlg('delete'); }}><UiIcon name="delete" /></button>}
          </div>
        ))}
        <button className="btn" onClick={() => setDlg('add')}>{t(lang, 'addMap')}</button>
      </div>
      {map && (
        <div className="card" style={{ flex: 1, minWidth: 0 }}>
          <h2>{t(lang, 'farmsOn')} · {map.name}</h2>
          <p className="muted" style={{ marginTop: 0 }}>{t(lang, 'farmHint')} ({map.ownedFarms.length}/{farms.length})</p>
          <div className="farmgrid">
            {farms.map(({ f, icon, serves }) => {
              const on = map.ownedFarms.includes(f.id);
              return (
                <label key={f.id} className={`farmrow ${on ? 'on' : ''}`}>
                  <input type="checkbox" checked={on} onChange={() => toggleFarm(map.id, f.id)} />
                  <Slot id={icon} name={f.en} />
                  <div style={{ minWidth: 0 }}>
                    <b>{farmName(f, lang)}</b>
                    {serves.length > 0 && <small>{t(lang, 'serves')}: {serves.slice(0, 4).join(', ')}{serves.length > 4 ? '…' : ''}</small>}
                    {on && (
                      <input className="farmnote-in" type="text" placeholder={t(lang, 'farmNotePh')}
                        defaultValue={map.farmNotes?.[f.id] ?? ''} key={`${map.id}-${f.id}`}
                        onClick={e => e.stopPropagation()}
                        onBlur={e => setFarmNote(map.id, f.id, e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}
      {dlg === 'add' && <Prompt lang={lang} title={t(lang, 'addMap')} initial="" onOk={v => addMap(v)} onClose={() => setDlg(null)} />}
      {dlg === 'rename' && map && <Prompt lang={lang} title={t(lang, 'rename')} initial={map.name} onOk={v => renameMap(map.id, v)} onClose={() => setDlg(null)} />}
      {dlg === 'delete' && map && (
        <Dialog title={`${t(lang, 'deleteMap')}: ${map.name}`} onClose={() => setDlg(null)}>
          <div>{t(lang, 'deleteMapQ')}</div>
          <label>{t(lang, 'moveTo')}
            <select value={moveTo} onChange={e => setMoveTo(e.target.value)}>
              {maps.filter(m => m.id !== map.id).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              <option value="">— {t(lang, 'deleteProjectsToo')} —</option>
            </select>
          </label>
          <div className="acts">
            <button className="btn" onClick={() => setDlg(null)}>{t(lang, 'cancel')}</button>
            <button className="btn primary" onClick={() => { deleteMap(map.id, moveTo || null); setDlg(null); }}>{t(lang, 'delete')}</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
