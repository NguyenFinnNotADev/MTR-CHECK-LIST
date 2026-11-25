// Builds 64×64 inventory-style icons into <app>/icons/<id>.png from the 1.21.11 game jar:
// block models → isometric 3D like the game's inventory, item sprites → flat, entity-rendered specials → flat fallback.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { renderModel } from './render3d.mjs';
import { entityModel } from './entity-models.mjs';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.resolve(SRC, '..');
const J = path.join(SRC, 'mc-assets', 'jar', 'assets', 'minecraft'); // 1.21.11 jar (preferred)
const T = path.join(SRC, 'mc-assets', 'template');          // 26.3.x template (fallback, entity textures)
const OUT = process.env.ICON_OUT ?? path.join(APP, 'icons');
fs.mkdirSync(OUT, { recursive: true });
const SIZE = 64;

const items = JSON.parse(fs.readFileSync(path.join(APP, 'database', 'items.json'), 'utf8'));
const rj = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const strip = s => s.replace(/^minecraft:/, '');
const firstExisting = (...ps) => ps.find(p => fs.existsSync(p));

const COLORS = 'white|orange|magenta|light_blue|yellow|lime|pink|gray|light_gray|cyan|purple|blue|brown|green|red|black';
const GRASS = 0x79c05a, FOLIAGE = 0x59ae30;

// Special items (entity-rendered in game) → texture + optional crop [x, y, w, h]
const special = [
  [new RegExp(`^(${COLORS})_(banner|bed)$`), m => ({ tex: `block/${m[1]}_wool` })],
  [/^skeleton_skull$/, () => ({ tex: 'entity/skeleton/skeleton', crop: [8, 8, 8, 8] })],
  [/^wither_skeleton_skull$/, () => ({ tex: 'entity/skeleton/wither_skeleton', crop: [8, 8, 8, 8] })],
  [/^zombie_head$/, () => ({ tex: 'entity/zombie/zombie', crop: [8, 8, 8, 8] })],
  [/^creeper_head$/, () => ({ tex: 'entity/creeper/creeper', crop: [8, 8, 8, 8] })],
  [/^piglin_head$/, () => ({ tex: 'entity/piglin/piglin', crop: [8, 8, 10, 8] })],
  [/^player_head$/, () => ({ tex: 'entity/player/wide/steve', crop: [8, 8, 8, 8] })],
  [/^decorated_pot$/, () => ({ tex: 'entity/decorated_pot/decorated_pot_side', crop: [1, 0, 14, 16] })],
  [/^(chest|trapped_chest)$/, () => ({ tex: 'block/oak_planks' })],
  [/^shield$/, () => ({ tex: 'block/oak_planks' })],
];

function texPath(ref) {
  const r = strip(ref);
  return firstExisting(path.join(J, 'textures', `${r}.png`), path.join(T, 'textures', `${r}.png`));
}
function modelJson(ref) {
  const r = strip(ref);
  const p = firstExisting(path.join(J, 'models', `${r}.json`), path.join(T, 'models', `${r}.json`));
  return p ? rj(p) : null;
}
function itemDef(id) {
  const p = firstExisting(path.join(J, 'items', `${id}.json`), path.join(T, 'items', `${id}.json`));
  return p ? rj(p) : null;
}

// Full model resolution: textures merged child-first, first elements, first display.gui, generated flag.
function resolveFull(ref) {
  const textures = {};
  let elements = null, gui = null, generated = false, m = modelJson(ref), cur = strip(ref), guard = 0;
  while (m && guard++ < 12) {
    for (const [k, v] of Object.entries(m.textures ?? {})) if (!(k in textures)) textures[k] = v;
    if (!elements && m.elements) elements = m.elements;
    if (!gui && m.display?.gui) gui = m.display.gui;
    if (!m.parent) break;
    const p = strip(m.parent);
    if (p === 'builtin/generated' || p === 'item/generated' || p === 'item/handheld') generated = true;
    if (p.startsWith('builtin/')) break;
    cur = p; m = modelJson(p);
  }
  return { textures, elements, gui, generated, cur };
}
const texCache = new Map();
function loadTex(ref) {
  if (texCache.has(ref)) return texCache.get(ref);
  const f = texPath(ref);
  let t = null;
  if (f) {
    const png = PNG.sync.read(fs.readFileSync(f));
    t = { w: png.width, h: png.width, data: png.data }; // frame 0 of animated strips
  }
  texCache.set(ref, t);
  return t;
}
function derefTex(textures, v) {
  let g = 0;
  while (g++ < 10) {
    if (v && typeof v === 'object') v = v.sprite;
    else if (typeof v === 'string' && v.startsWith('#')) v = textures[v.slice(1)];
    else break;
  }
  return typeof v === 'string' ? v : null;
}
// find first plain model reference (+ tint) inside an item definition
function findModel(node) {
  if (!node || typeof node !== 'object') return null;
  if (node.type && strip(node.type) === 'model' && typeof node.model === 'string') return { model: node.model, tints: node.tints };
  if (node.type && strip(node.type) === 'special' && typeof node.base === 'string') return { model: node.base, tints: node.tints, special: true };
  for (const k of ['model', 'models', 'fallback', 'cases', 'entries', 'on_true', 'on_false']) {
    const v = node[k];
    const arr = Array.isArray(v) ? v : v ? [v] : [];
    for (const x of arr) { const r = findModel(x.model && typeof x.model === 'object' ? x.model : x); if (r) return r; }
  }
  return null;
}
function resolveTextures(ref) {
  const tex = {};
  let m = modelJson(ref), guard = 0;
  while (m && guard++ < 10) {
    for (const [k, v] of Object.entries(m.textures ?? {})) if (!(k in tex)) tex[k] = v;
    m = m.parent ? modelJson(m.parent) : null;
  }
  const deref = v => {
    let g = 0;
    while (g++ < 10) {
      if (v && typeof v === 'object') v = v.sprite;
      else if (typeof v === 'string' && v.startsWith('#')) v = tex[v.slice(1)];
      else break;
    }
    return v;
  };
  for (const k of ['layer0', 'all', 'side', 'texture', 'wool', 'pattern', 'end', 'top', 'front', 'cross', 'plant', 'stem', 'particle']) {
    const v = deref(tex[k]);
    if (typeof v === 'string' && texPath(v)) return { tex: v, layer: k === 'layer0' };
  }
  return null;
}
const tintColor = t => {
  if (!t) return null;
  const type = strip(t.type ?? '');
  if (type === 'constant') return t.value & 0xffffff;
  if (type === 'grass') return GRASS;
  if (type === 'foliage') return FOLIAGE;
  if (typeof t.default === 'number') return t.default & 0xffffff;
  return null;
};

// ---------- shape masks on a 16×16 grid, so variants of one block look different ----------
const rect = (x0, y0, x1, y1) => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
const any = (...fs) => (x, y) => fs.some(f => f(x, y));
const SHAPES = [
  [/_stairs$/, any(rect(0, 8, 15, 15), rect(0, 0, 7, 7))],
  [/_slab$/, rect(0, 8, 15, 15)],
  [/_fence_gate$/, any(rect(0, 3, 2, 14), rect(13, 3, 15, 14), rect(3, 4, 12, 6), rect(3, 10, 12, 12), rect(6, 4, 9, 12))],
  [/_fence$/, any(rect(2, 0, 5, 15), rect(10, 0, 13, 15), rect(6, 3, 9, 5), rect(6, 9, 9, 11))],
  [/_wall$/, any(rect(4, 0, 11, 15), rect(0, 4, 15, 15))],
  [/_pressure_plate$/, rect(1, 12, 14, 15)],
  [/_button$/, rect(4, 6, 11, 10)],
  [/_carpet$/, rect(0, 12, 15, 15)],
  [/_banner$/, any(rect(1, 0, 14, 1), rect(4, 2, 11, 13), rect(5, 14, 10, 15))],
  [/_bed$/, any(rect(0, 6, 15, 12), rect(0, 13, 1, 15), rect(14, 13, 15, 15), rect(0, 3, 4, 5))],
  [/_pane$/, rect(5, 0, 10, 15)],
];
const shapeOf = id => SHAPES.find(([re]) => re.test(id))?.[1] ?? null;

function render(texFile, { crop, tint, shape } = {}) {
  const src = PNG.sync.read(fs.readFileSync(texFile));
  let [cx, cy, cw, ch] = crop ?? [0, 0, src.width, Math.min(src.width, src.height)]; // frame 0 of animations
  const out = new PNG({ width: SIZE, height: SIZE });
  const scale = Math.min(SIZE / cw, SIZE / ch);
  const ox = Math.floor((SIZE - cw * scale) / 2), oy = Math.floor((SIZE - ch * scale) / 2);
  const tr = tint != null ? [(tint >> 16) & 255, (tint >> 8) & 255, tint & 255] : null;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const sx = Math.floor((x - ox) / scale), sy = Math.floor((y - oy) / scale);
    const o = (y * SIZE + x) * 4;
    if (sx < 0 || sy < 0 || sx >= cw || sy >= ch) { out.data[o + 3] = 0; continue; }
    const i = ((cy + sy) * src.width + (cx + sx)) * 4;
    let r = src.data[i], g = src.data[i + 1], b = src.data[i + 2];
    if (tr) { r = r * tr[0] / 255 | 0; g = g * tr[1] / 255 | 0; b = b * tr[2] / 255 | 0; }
    out.data[o] = r; out.data[o + 1] = g; out.data[o + 2] = b; out.data[o + 3] = src.data[i + 3];
  }
  if (shape) applyShape(out, shape);
  return PNG.sync.write(out);
}

/** Cut the 64×64 image to a 16-grid silhouette and darken its 1-cell outline for readability. */
function applyShape(img, shape) {
  const cell = SIZE / 16;
  const inside = (gx, gy) => gx >= 0 && gy >= 0 && gx < 16 && gy < 16 && shape(gx, gy);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const gx = Math.floor(x / cell), gy = Math.floor(y / cell), o = (y * SIZE + x) * 4;
    if (!inside(gx, gy)) { img.data[o + 3] = 0; continue; }
    const edge = !inside(gx - 1, gy) || !inside(gx + 1, gy) || !inside(gx, gy - 1) || !inside(gx, gy + 1);
    const lx = x % cell, ly = y % cell;
    const onBorder = (!inside(gx - 1, gy) && lx === 0) || (!inside(gx + 1, gy) && lx === cell - 1)
      || (!inside(gx, gy - 1) && ly === 0) || (!inside(gx, gy + 1) && ly === cell - 1);
    if (edge && onBorder) for (let c = 0; c < 3; c++) img.data[o + c] = img.data[o + c] * 0.45 | 0;
  }
}

function loadTexRaw(ref) {
  const key = `raw:${ref}`;
  if (texCache.has(key)) return texCache.get(key);
  const f = texPath(ref);
  const png = f ? PNG.sync.read(fs.readFileSync(f)) : null;
  const t = png ? { w: png.width, h: png.height, data: png.data } : null;
  texCache.set(key, t);
  return t;
}

let ok = 0, n3d = 0, nEnt = 0; const missing = [];
for (const { id } of items) {
  // entity-rendered items (chests, beds, banners, heads…) → hand-built box models
  const em = entityModel(id);
  if (em) {
    try {
      const img = renderModel({ elements: em.elements, gui: em.gui, fit: em.fit }, ref => loadTexRaw(em.textures[ref] ?? ref), [], SIZE);
      if (img.data.some((v, i) => i % 4 === 3 && v > 0)) {
        fs.writeFileSync(path.join(OUT, `${id}.png`), PNG.sync.write(img));
        ok++; nEnt++;
        continue;
      }
    } catch (e) { console.warn('[entity]', id, e.message); }
  }
  let job = null;
  for (const [re, fn] of special) { const m = id.match(re); if (m) { job = fn(m); break; } }
  // 3D path: item definition → block model with elements (what the inventory shows)
  if (!job) {
    const def = itemDef(id);
    const mref = def && findModel(def.model);
    if (mref && !mref.special) {
      const full = resolveFull(mref.model);
      if (full.elements && !full.generated) {
        const tints = (mref.tints ?? []).map(tintColor);
        if (!tints.length && /_leaves$/.test(id) && !/^(cherry|azalea|flowering_azalea|pale_oak)_leaves$/.test(id)) tints[0] = FOLIAGE;
        const getTex = ref => { const r = derefTex(full.textures, ref); return r ? loadTex(r) : null; };
        try {
          const img = renderModel({ elements: full.elements, gui: full.gui }, getTex, tints, SIZE);
          if (img.data.some((v, i) => i % 4 === 3 && v > 0)) {
            fs.writeFileSync(path.join(OUT, `${id}.png`), PNG.sync.write(img));
            ok++; n3d++;
            continue;
          }
        } catch (e) { /* fall through to flat */ }
      }
    }
  }
  if (!job) {
    const def = itemDef(id);
    const mref = def && findModel(def.model);
    const t = mref && resolveTextures(mref.model);
    if (t) job = { tex: strip(t.tex), tint: tintColor(mref.tints?.[0]), layer: t.layer };
    // leaves/grass block models without explicit tint
    if (job && job.tint == null && /_leaves$/.test(id) && !/^(cherry|azalea|flowering_azalea|pale_oak)_leaves$/.test(id)) job.tint = FOLIAGE;
  }
  // block-model items (not item sprites like doors/signs) get a silhouette by type
  if (job && !job.crop && (!job.layer || /_pane$/.test(id))) job.shape = shapeOf(id);
  const file = job && texPath(job.tex);
  if (!file) { missing.push(id); continue; }
  try { fs.writeFileSync(path.join(OUT, `${id}.png`), render(file, job)); ok++; }
  catch (e) { missing.push(`${id} (${e.message})`); }
}
fs.writeFileSync(path.join(SRC, 'mc-assets', 'icons-missing.txt'), missing.join('\n'));
console.log(`[icons] ${ok} written (${n3d} 3D, ${nEnt} entity),${missing.length} missing (see mc-assets/icons-missing.txt)`);
