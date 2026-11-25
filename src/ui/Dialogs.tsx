import { useState, type ReactNode } from 'react';
import { farmName } from '../core/db';
import type { DbGroup, Lang } from '../core/types';
import { t } from '../i18n';
import { useStore } from '../store';
import { UiIcon, type UiIconName } from './Icon';

export function Dialog({ title, children, onClose, icon }: { title: string; children: ReactNode; onClose: () => void; icon?: UiIconName }) {
  return (
    <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
      <div className="dialog" role="dialog" aria-label={title}>
        <h3>{icon && <UiIcon name={icon} size={24} />}{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function Confirm({ text, onYes, onClose, yes, lang }: { text: string; onYes: () => void; onClose: () => void; yes?: string; lang: Lang }) {
  return (
    <Dialog title={lang === 'en' ? 'Are you sure?' : 'Chắc chưa?'} icon="warning" onClose={onClose}>
      <div>{text}</div>
      <div className="acts">
        <button className="btn" onClick={onClose}>{t(lang, 'cancel')}</button>
        <button className="btn primary" autoFocus onClick={() => { onYes(); onClose(); }}>{yes ?? t(lang, 'delete')}</button>
      </div>
    </Dialog>
  );
}

export function Prompt({ title, initial, onOk, onClose, lang, allowEmpty }: { title: string; initial: string; onOk: (v: string) => void; onClose: () => void; lang: Lang; allowEmpty?: boolean }) {
  const [v, setV] = useState(initial);
  return (
    <Dialog title={title} onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); if (v.trim() || allowEmpty) { onOk(v.trim()); onClose(); } }} style={{ display: 'contents' }}>
        <input type="text" value={v} autoFocus onChange={e => setV(e.target.value)} onFocus={e => e.target.select()} />
        <div className="acts">
          <button type="button" className="btn" onClick={onClose}>{t(lang, 'cancel')}</button>
          <button type="submit" className="btn primary">{t(lang, 'save')}</button>
        </div>
      </form>
    </Dialog>
  );
}

/** Pick name + map for a freshly parsed list. */
export function ImportDialog({ schematic, onOk, onClose }: { schematic: string; onOk: (name: string, mapId: string) => void; onClose: () => void }) {
  const { maps, settings, projects, addMap } = useStore();
  const lang = settings.lang;
  const cur = settings.currentProject ? projects[settings.currentProject]?.mapId : undefined;
  const [name, setName] = useState(schematic);
  const [mapId, setMapId] = useState(cur ?? maps[0]?.id ?? '__new');
  const [newMap, setNewMap] = useState('');
  const submit = () => {
    let m = mapId;
    if (m === '__new') { if (!newMap.trim()) return; m = addMap(newMap); }
    onOk(name.trim() || schematic, m);
    onClose();
  };
  return (
    <Dialog title={t(lang, 'importTitle')} onClose={onClose}>
      <label>{t(lang, 'projectName')}<input type="text" value={name} autoFocus onChange={e => setName(e.target.value)} /></label>
      <label>{t(lang, 'map')}
        <select value={mapId} onChange={e => setMapId(e.target.value)}>
          {maps.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          <option value="__new">{t(lang, 'newMap')}</option>
        </select>
      </label>
      {mapId === '__new' && <label>{t(lang, 'newMapName')}<input type="text" value={newMap} onChange={e => setNewMap(e.target.value)} /></label>}
      <div className="acts">
        <button className="btn" onClick={onClose}>{t(lang, 'cancel')}</button>
        <button className="btn primary" onClick={submit}>{t(lang, 'create')}</button>
      </div>
    </Dialog>
  );
}

export function ClassifyDialog({ rawName, onClose }: { rawName: string; onClose: () => void }) {
  const { db, settings, classify } = useStore();
  const lang = settings.lang;
  const groups = [...db!.groups.values()].filter(g => !g.derived) as DbGroup[];
  groups.sort((a, b) => a.en.localeCompare(b.en));
  const [group, setGroup] = useState(groups[0]?.id ?? '__new');
  const [gName, setGName] = useState('');
  const [farms, setFarms] = useState<string[]>([]);
  const [howTo, setHowTo] = useState('');
  const [vi, setVi] = useState('');
  const [stack, setStack] = useState(64);
  const submit = () => {
    if (group === '__new' && !gName.trim()) return;
    classify(rawName, {
      group, vi, stack,
      newGroup: group === '__new' ? { en: gName.trim(), farms, howTo } : undefined,
    });
    onClose();
  };
  return (
    <Dialog title={`${t(lang, 'classifyTitle')}: ${rawName}`} onClose={onClose}>
      <label>{t(lang, 'group')}
        <select value={group} onChange={e => setGroup(e.target.value)}>
          {groups.map(g => <option key={g.id} value={g.id}>{lang === 'vi' ? g.vi : g.en}</option>)}
          <option value="__new">{t(lang, 'newGroup')}</option>
        </select>
      </label>
      {group === '__new' && (
        <>
          <label>{t(lang, 'newGroupName')}<input type="text" value={gName} onChange={e => setGName(e.target.value)} /></label>
          <label>{t(lang, 'farms')} <span>({t(lang, 'notFarmable')} = {lang === 'en' ? 'tick none' : 'không tick'})</span>
            <div className="checks">
              {[...db!.farms.values()].map(f => (
                <label key={f.id}>
                  <input type="checkbox" checked={farms.includes(f.id)}
                    onChange={() => setFarms(farms.includes(f.id) ? farms.filter(x => x !== f.id) : [...farms, f.id])} />
                  {farmName(f, lang)}
                </label>
              ))}
            </div>
          </label>
          {!farms.length && <label>{t(lang, 'howTo')}<input type="text" value={howTo} onChange={e => setHowTo(e.target.value)} /></label>}
        </>
      )}
      <label>{t(lang, 'viName')}<input type="text" value={vi} onChange={e => setVi(e.target.value)} /></label>
      <label>{t(lang, 'stackSize')}
        <select value={stack} onChange={e => setStack(Number(e.target.value))}>
          {[64, 16, 1].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <div className="acts">
        <button className="btn" onClick={onClose}>{t(lang, 'cancel')}</button>
        <button className="btn primary" onClick={submit}>{t(lang, 'save')}</button>
      </div>
    </Dialog>
  );
}
