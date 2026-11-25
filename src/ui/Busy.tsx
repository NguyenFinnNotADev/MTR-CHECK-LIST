import type { Lang } from '../core/types';

/** Full-window "saving / loading" screen (same pixel block as the launch splash). */
export function BusyOverlay({ kind, lang }: { kind: 'saving' | 'loading'; lang: Lang }) {
  const text = kind === 'saving'
    ? (lang === 'en' ? 'Saving…' : 'Đang lưu…')
    : (lang === 'en' ? 'Loading…' : 'Đang tải…');
  return (
    <div className="busy" role="status" aria-live="polite">
      <div className="sp">
        <div className="sp-block">{Array.from({ length: 9 }, (_, i) => <i key={i} />)}</div>
        <div className="sp-title">{text}</div>
        <div className="sp-bar"><i /></div>
      </div>
    </div>
  );
}

/** Fade the boot splash out once the app is ready. */
export function hideSplash(instant: boolean) {
  const el = document.getElementById('splash');
  if (!el) return;
  if (instant) { el.remove(); return; }
  el.classList.add('out');
  setTimeout(() => el.remove(), 380);
}
