import { projectProgress } from '../core/view';
import { t } from '../i18n';
import { useStore, type Tab } from '../store';
import { UiIcon, type UiIconName } from './Icon';

export function Sidebar({ onPick }: { onPick: () => void }) {
  const { maps, projects, settings, tab, setTab, selectProject } = useStore();
  const lang = settings.lang;
  const tabs: [Tab, Parameters<typeof t>[1], UiIconName][] = [
    ['materials', 'tabMaterials', 'materials'], ['plan', 'tabPlan', 'plan'], ['maps', 'tabMaps', 'maps'], ['settings', 'tabSettings', 'settings'],
  ];
  return (
    <aside className="side">
      <div className="brand">
        <img src="/logo.png" alt="" draggable={false} />
        <div>MTR Check list<small>{t(lang, 'appSub')}</small></div>
      </div>
      {maps.map(m => {
        const ps = Object.values(projects).filter(p => p.mapId === m.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        if (!ps.length) return null;
        return (
          <div key={m.id} style={{ display: 'contents' }}>
            <div className="lbl">Map · {m.name}</div>
            {ps.map(p => {
              const pr = projectProgress(p);
              return (
                <button key={p.id} className={`proj ${p.id === settings.currentProject && tab === 'materials' ? 'on' : ''}`} onClick={() => selectProject(p.id)} title={p.name}>
                  <b>{p.name}</b>
                  <span>{p.items.length} {t(lang, 'types')} · {Math.round(pr * 100)}%</span>
                  <div className="bar"><i style={{ width: `${pr * 100}%` }} /></div>
                </button>
              );
            })}
          </div>
        );
      })}
      <button className="btn" onClick={onPick}><UiIcon name="pick" />{t(lang, 'pickFile')}</button>
      <nav className="tabs">
        {tabs.map(([id, k, ic]) => (
          <button key={id} className={`tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}><UiIcon name={ic} size={20} />{t(lang, k)}</button>
        ))}
      </nav>
    </aside>
  );
}
