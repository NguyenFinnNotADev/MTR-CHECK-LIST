// "Full" animation level: inertial smooth scrolling with a light vertical motion blur.
// One global wheel listener drives whichever scroll container is under the cursor.

const SCROLLERS = '.scroll, .page, .mini-list, .dialog';
const SVG_NS = 'http://www.w3.org/2000/svg';

interface Anim { el: HTMLElement; target: number; pos: number; raf: number }
const running = new Map<HTMLElement, Anim>();
let blurNode: SVGFEGaussianBlurElement | null = null;

function ensureFilter() {
  if (blurNode) return;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.id = 'mtr-vblur';
  filter.setAttribute('x', '0'); filter.setAttribute('y', '-5%'); filter.setAttribute('width', '100%'); filter.setAttribute('height', '110%');
  blurNode = document.createElementNS(SVG_NS, 'feGaussianBlur');
  blurNode.setAttribute('stdDeviation', '0 0');
  filter.appendChild(blurNode);
  svg.appendChild(filter);
  document.body.appendChild(svg);
}

function step(a: Anim) {
  const d = a.target - a.pos;
  a.pos += d * 0.16;
  if (Math.abs(d) < 0.5) a.pos = a.target;
  a.el.scrollTop = a.pos;
  // blur grows with speed, capped so text stays readable
  const v = Math.min(1.6, Math.abs(d) / 110);
  if (blurNode) blurNode.setAttribute('stdDeviation', `0 ${v.toFixed(2)}`);
  a.el.classList.toggle('mblur', v > 0.08);
  if (a.pos !== a.target) a.raf = requestAnimationFrame(() => step(a));
  else { a.el.classList.remove('mblur'); running.delete(a.el); }
}

function onWheel(e: WheelEvent) {
  if (e.ctrlKey || e.defaultPrevented) return;
  const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(SCROLLERS);
  if (!el || el.scrollHeight <= el.clientHeight + 1) return;
  // let inner scrollables (selects, raw tables…) handle their own wheel
  const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * el.clientHeight : e.deltaY;
  e.preventDefault();
  let a = running.get(el);
  if (!a) { a = { el, target: el.scrollTop, pos: el.scrollTop, raf: 0 }; running.set(el, a); a.raf = requestAnimationFrame(() => step(a!)); }
  const max = el.scrollHeight - el.clientHeight;
  a.target = Math.max(0, Math.min(max, a.target + dy * 1.1));
}

let installed = false;
export function installFullMotion() {
  if (installed) return;
  installed = true;
  ensureFilter();
  window.addEventListener('wheel', onWheel, { passive: false });
  // keep the animation in sync when the user drags the scrollbar / uses keys
  window.addEventListener('scroll', e => {
    const el = e.target as HTMLElement;
    if (el instanceof HTMLElement && !running.has(el)) return;
  }, true);
}

/** Tween a number for "full" mode (returns cancel). */
export function tweenNumber(from: number, to: number, ms: number, cb: (v: number) => void) {
  const t0 = performance.now();
  let raf = 0;
  const tick = (now: number) => {
    const k = Math.min(1, (now - t0) / ms);
    const e = 1 - Math.pow(1 - k, 3);
    cb(Math.round(from + (to - from) * e));
    if (k < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
