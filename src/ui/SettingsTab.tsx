import { useEffect, useState } from 'react';
import type { Lang, Theme } from '../core/types';
import { t } from '../i18n';
import * as io from '../platform';
import { useStore } from '../store';
import { Confirm } from './Dialogs';
import { UiIcon } from './Icon';

// swatches: background · panel · accent · status (collecting) · status (done)
const THEMES: { id: Theme; vi: string; en: string; sw: string[] }[] = [
  { id: 'beige', vi: 'Be cozy', en: 'Cozy beige', sw: ['#f3e9d7', '#fffaf0', '#c9783f', '#3f7fd0', '#5f9a45'] },
  { id: 'white', vi: 'Trắng', en: 'White', sw: ['#f4f5f7', '#ffffff', '#2f6fde', '#2f6fde', '#2e9a5b'] },
  { id: 'black', vi: 'Đen', en: 'Black', sw: ['#111214', '#1a1b1f', '#f0b44c', '#5b9cf5', '#4fc27f'] },
  { id: 'gray', vi: 'Xám', en: 'Gray', sw: ['#cdd0d4', '#eceef0', '#46525f', '#346bb9', '#33844f'] },
  { id: 'blue', vi: 'Xanh dương pastel', en: 'Pastel blue', sw: ['#e6eefa', '#f8fbff', '#4f82d6', '#4f82d6', '#4aa37b'] },
  { id: 'medieval', vi: 'Nâu medieval', en: 'Medieval brown', sw: ['#3b2a1c', '#f4e8cc', '#8e2f1c', '#3e6a9a', '#4f7a2f'] },
  { id: 'pink', vi: 'Hồng pastel', en: 'Pastel pink', sw: ['#fbecf1', '#fffafc', '#d9668d', '#6b8fe0', '#55a57a'] },
];

export function SettingsTab() {
  const { settings, setSettings, exportAll, importAll, bootAnim, relaunchApp } = useStore();
  const lang = settings.lang;
  const [pending, setPending] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ game?: string; items?: number } | null>(null);
  const [found, setFound] = useState<string[]>([]);
  useEffect(() => { io.readDatabase('meta.json').then(m => setMeta(m as typeof meta)).catch(() => {}); }, []);
  useEffect(() => { io.findLitematicaDirs().then(setFound).catch(() => {}); }, []);

  return (
    <div className="page">
      <div className="settings">
        <div className="card">
          <h2><UiIcon name="language" size={24} />{t(lang, 'language')}</h2>
          <div className="seg">
            {([['en', 'English'], ['vi', 'Tiếng Việt'], ['duo', 'Duo (EN + VI)']] as [Lang, string][]).map(([l, n]) => (
              <button key={l} className={lang === l ? 'on' : ''} onClick={() => setSettings({ lang: l })}>{n}</button>
            ))}
          </div>
        </div>
        <div className="card">
          <h2><UiIcon name="theme" size={24} />{t(lang, 'theme')}</h2>
          <div className="themes">
            {THEMES.map(th => (
              <button key={th.id} className={`themecard ${settings.theme === th.id ? 'on' : ''}`} onClick={() => setSettings({ theme: th.id })}>
                <div className="sw">{th.sw.map((c, i) => <i key={i} style={{ background: c }} />)}</div>
                <b>{lang === 'en' ? th.en : th.vi}</b>
              </button>
            ))}
          </div>
        </div>
        <div className="card">
          <h2><UiIcon name="pick" size={24} />{t(lang, 'materialsDir')}</h2>
          <div className="pathrow">
            <code className={settings.materialsDir ? '' : 'muted'}>{settings.materialsDir ?? t(lang, 'notSet')}</code>
            <button className="btn" onClick={async () => { const p = await io.pickFolder(settings.materialsDir); if (p) setSettings({ materialsDir: p }); }}><UiIcon name="folder" />{t(lang, 'chooseFolder')}</button>
            {settings.materialsDir && <button className="btn" onClick={() => setSettings({ materialsDir: null })}>{t(lang, 'clear')}</button>}
          </div>
          <p className="muted small">{t(lang, 'materialsDirHint')}</p>
          {found.length > 0 && (
            <div className="found">
              <span className="muted small">{t(lang, 'found')}:</span>
              {found.map(f => (
                <button key={f} className={`btn ${settings.materialsDir === f ? 'on' : ''}`} title={f} onClick={() => setSettings({ materialsDir: f })}>
                  {f.split(/[\\/]/).filter(Boolean).pop()}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h2><UiIcon name="animation" size={24} />{t(lang, 'animations')}</h2>
          <div className="seg">
            {([['lite', 'animLite'], ['full', 'animFull'], ['off', 'animOff']] as const).map(([v, k]) => (
              <button key={v} className={settings.anim === v ? 'on' : ''} onClick={() => setSettings({ anim: v })}>{t(lang, k)}</button>
            ))}
          </div>
          <p className="muted small">{t(lang, settings.anim === 'full' ? 'animFullDesc' : settings.anim === 'off' ? 'animOffDesc' : 'animLiteDesc')}</p>
          <div className="pathrow">
            <button className={`btn ${settings.anim !== bootAnim ? 'primary' : ''}`} onClick={() => void relaunchApp()}><UiIcon name="reset" />{t(lang, 'relaunch')}</button>
            {settings.anim !== bootAnim && <span className="muted small">{t(lang, 'relaunchHint')}</span>}
          </div>
        </div>
        <div className="card">
          <h2><UiIcon name="mini" size={24} />{t(lang, 'miniSettings')}</h2>
          <label className="check"><input type="checkbox" checked={settings.hideMainOnMini} onChange={e => setSettings({ hideMainOnMini: e.target.checked })} /> {t(lang, 'hideMainOnMini')}</label>
          <label className="check"><input type="checkbox" checked={settings.miniOnTop} onChange={e => setSettings({ miniOnTop: e.target.checked })} /> {t(lang, 'onTop')}</label>
          <label className="check">{t(lang, 'opacity')}
            <input type="range" min={0.35} max={1} step={0.05} value={settings.miniOpacity} onChange={e => setSettings({ miniOpacity: Number(e.target.value) })} />
            {Math.round(settings.miniOpacity * 100)}%</label>
        </div>
        <div className="card">
          <h2><UiIcon name="export" size={24} />{t(lang, 'backup')}</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" onClick={async () => { if (await io.exportBackup(exportAll())) setMsg('✔'); }}><UiIcon name="export" />{t(lang, 'exportBackup')}</button>
            <button className="btn" onClick={async () => { const s = await io.pickBackup(); if (s) setPending(s); }}><UiIcon name="import" />{t(lang, 'importBackup')}</button>
            {io.isTauri && <button className="btn" onClick={() => io.openDataFolder()}><UiIcon name="folder" />{t(lang, 'openFolder')}</button>}
            {msg && <span className="muted" style={{ alignSelf: 'center' }}>{msg}</span>}
          </div>
        </div>
        {meta && <p className="muted">{t(lang, 'dataInfo')}: {meta.game?.split('\n')[0]} · {meta.items} items</p>}
      </div>
      {pending && (
        <Confirm lang={lang} text={t(lang, 'importBackupQ')} yes={t(lang, 'importBackup')}
          onYes={() => { try { importAll(pending); setMsg('✔'); } catch (e) { setMsg(String(e)); } }}
          onClose={() => setPending(null)} />
      )}
    </div>
  );
}
