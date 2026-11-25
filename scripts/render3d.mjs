// Tiny software renderer for Minecraft block models → inventory-style isometric icons.
// Reads vanilla model JSON (elements, faces, uv, rotation, display.gui) like the game does.
import { PNG } from 'pngjs';

const D2R = Math.PI / 180;

// ---------- small vector/matrix helpers (row-major 3×3) ----------
const mul = (a, b) => {
  const r = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return r;
};
const apply = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const rotX = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const rotY = a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const rotZ = a => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };

// Default UVs per face direction from element bounds (vanilla FaceBakery behaviour)
function defaultUV(dir, f, t) {
  switch (dir) {
    case 'down': return [f[0], 16 - t[2], t[0], 16 - f[2]];
    case 'up': return [f[0], f[2], t[0], t[2]];
    case 'north': return [16 - t[0], 16 - t[1], 16 - f[0], 16 - f[1]];
    case 'south': return [f[0], 16 - t[1], t[0], 16 - f[1]];
    case 'west': return [f[2], 16 - t[1], t[2], 16 - f[1]];
    case 'east': return [16 - t[2], 16 - t[1], 16 - f[2], 16 - f[1]];
  }
}
// Quad corners (model space) for each face, ordered top-left, top-right, bottom-right, bottom-left as seen from outside
function faceCorners(dir, f, t) {
  const [x0, y0, z0] = f, [x1, y1, z1] = t;
  switch (dir) {
    case 'up': return [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
    case 'down': return [[x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0]];
    case 'north': return [[x1, y1, z0], [x0, y1, z0], [x0, y0, z0], [x1, y0, z0]];
    case 'south': return [[x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [x0, y0, z1]];
    case 'west': return [[x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [x0, y0, z0]];
    case 'east': return [[x1, y1, z1], [x1, y1, z0], [x1, y0, z0], [x1, y0, z1]];
  }
}
const NORMALS = { up: [0, 1, 0], down: [0, -1, 0], north: [0, 0, -1], south: [0, 0, 1], west: [-1, 0, 0], east: [1, 0, 0] };

/**
 * @param model   resolved model: { elements, textures (resolved to {img}), gui: {rotation, translation, scale} }
 * @param getTex  (ref) => {w, h, data} | null   (frame 0 already)
 * @param tints   array of 0xRRGGBB by tintindex (or undefined)
 */
export function renderModel(model, getTex, tints = [], size = 64) {
  const SS = 2, S = size * SS; // supersample 2× then box-downsample
  const color = new Float32Array(S * S * 4);
  const depth = new Float32Array(S * S).fill(-Infinity);
  const gui = model.gui ?? { rotation: [30, 225, 0], translation: [0, 0, 0], scale: [0.625, 0.625, 0.625] };
  const R = mul(mul(rotX(gui.rotation[0] * D2R), rotY(gui.rotation[1] * D2R)), rotZ(gui.rotation[2] * D2R));
  const sc = gui.scale ?? [1, 1, 1], tr = gui.translation ?? [0, 0, 0];
  const px = S / 16; // one model unit at scale 1 = 1 GUI pixel; the icon is 16 GUI pixels wide

  const toScreen = p => {
    // centre, display transform (scale → rotate → translate), then GUI ortho (y up → screen down)
    let v = [(p[0] - 8) * sc[0], (p[1] - 8) * sc[1], (p[2] - 8) * sc[2]];
    v = apply(R, v);
    return [S / 2 + (v[0] + tr[0]) * px, S / 2 - (v[1] + tr[1]) * px, v[2] + tr[2]];
  };

  const quads = [];
  for (const el of model.elements ?? []) {
    let er = null;
    if (el.rotation && el.rotation.angle) {
      const a = el.rotation.angle * D2R, o = el.rotation.origin ?? [8, 8, 8];
      const m = el.rotation.axis === 'x' ? rotX(a) : el.rotation.axis === 'y' ? rotY(a) : rotZ(a);
      let rs = [1, 1, 1];
      if (el.rotation.rescale) {
        const k = 1 / Math.cos(Math.abs(a));
        rs = el.rotation.axis === 'x' ? [1, k, k] : el.rotation.axis === 'y' ? [k, 1, k] : [k, k, 1];
      }
      er = p => { const d = [(p[0] - o[0]) * 1, p[1] - o[1], p[2] - o[2]]; const q = apply(m, d); return [q[0] * rs[0] + o[0], q[1] * rs[1] + o[1], q[2] * rs[2] + o[2]]; };
    }
    for (const [dir, face] of Object.entries(el.faces ?? {})) {
      const tex = getTex(face.texture);
      if (!tex) continue;
      let corners = faceCorners(dir, el.from, el.to);
      let n = NORMALS[dir];
      if (er) { corners = corners.map(er); const o = er([0, 0, 0]); const nn = er(n); n = [nn[0] - o[0], nn[1] - o[1], nn[2] - o[2]]; }
      const sp = corners.map(toScreen);
      const nv = apply(R, n);
      if (nv[2] <= 1e-4) continue; // back-face
      const uv = face.uv ?? defaultUV(dir, el.from, el.to);
      // brightness like the GUI's side lighting: top brightest, left side lighter than right
      const len = Math.hypot(nv[0], nv[1], nv[2]) || 1;
      const ny = nv[1] / len, nx = nv[0] / len;
      let shade = el.shade === false ? 1 : Math.min(1, 0.62 + 0.38 * Math.max(0, ny) + (nx < 0 ? 0.18 * -nx : -0.02 * nx));
      if (ny < -0.3) shade = 0.5;
      const tint = face.tint ?? (face.tintindex != null && tints[face.tintindex] != null ? tints[face.tintindex] : null);
      quads.push({ sp, uv: face.uvPx ?? uv, px: !!face.uvPx, rot: face.rotation ?? 0, tex, shade, tint, z: sp.reduce((s, p) => s + p[2], 0) / 4 });
    }
  }
  // entity models: scale/centre the projected shape to fill the icon
  if (model.fit && quads.length) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of quads) for (const p of q.sp) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    const k = (S * (model.fit === true ? 0.92 : model.fit)) / Math.max(x1 - x0, y1 - y0);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    for (const q of quads) q.sp = q.sp.map(p => [S / 2 + (p[0] - cx) * k, S / 2 + (p[1] - cy) * k, p[2]]);
  }
  quads.sort((a, b) => a.z - b.z); // back to front for translucent blending

  for (const q of quads) rasterQuad(q, color, depth, S);

  // downsample
  const out = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) {
      const i = ((y * SS + dy) * S + (x * SS + dx)) * 4;
      const al = color[i + 3];
      r += color[i] * al; g += color[i + 1] * al; b += color[i + 2] * al; a += al;
    }
    const o = (y * size + x) * 4;
    if (a > 0) { out.data[o] = r / a; out.data[o + 1] = g / a; out.data[o + 2] = b / a; }
    out.data[o + 3] = Math.round((a / (SS * SS)) * 255);
  }
  return out;
}

function rasterQuad(q, color, depth, S) {
  const [p0, p1, , p3] = q.sp;
  const ex = [p1[0] - p0[0], p1[1] - p0[1]], ey = [p3[0] - p0[0], p3[1] - p0[1]];
  const det = ex[0] * ey[1] - ex[1] * ey[0];
  if (Math.abs(det) < 1e-6) return;
  const xs = q.sp.map(p => p[0]), ys = q.sp.map(p => p[1]);
  const minX = Math.max(0, Math.floor(Math.min(...xs))), maxX = Math.min(S - 1, Math.ceil(Math.max(...xs)));
  const minY = Math.max(0, Math.floor(Math.min(...ys))), maxY = Math.min(S - 1, Math.ceil(Math.max(...ys)));
  const [u0, v0, u1, v1] = q.uv;
  const { tex } = q;
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const dx = x + 0.5 - p0[0], dy = y + 0.5 - p0[1];
    let s = (dx * ey[1] - dy * ey[0]) / det, t = (ex[0] * dy - ex[1] * dx) / det;
    if (s < 0 || s > 1 || t < 0 || t > 1) continue;
    const z = p0[2] + s * (p1[2] - p0[2]) + t * (q.sp[3][2] - p0[2]);
    // face rotation rotates the texture on the face
    let a = s, b = t;
    for (let r = 0; r < q.rot; r += 90) { const na = b, nb = 1 - a; a = na; b = nb; }
    const u = u0 + (u1 - u0) * a, v = v0 + (v1 - v0) * b;
    const th = tex.h ?? tex.w;
    const tx = q.px
      ? Math.min(tex.w - 1, Math.max(0, Math.floor(u - 1e-6 * Math.sign(u1 - u0))))
      : Math.min(tex.w - 1, Math.max(0, Math.floor((u / 16) * tex.w - 1e-6 * Math.sign(u1 - u0))));
    const ty = q.px
      ? Math.min(th - 1, Math.max(0, Math.floor(v - 1e-6 * Math.sign(v1 - v0))))
      : Math.min(tex.w - 1, Math.max(0, Math.floor((v / 16) * tex.w - 1e-6 * Math.sign(v1 - v0))));
    const ti = (ty * tex.w + tx) * 4;
    const al = tex.data[ti + 3] / 255;
    if (al < 0.1) continue;
    const i = y * S + x;
    if (z < depth[i] - 1e-3) continue;
    let r = tex.data[ti], g = tex.data[ti + 1], bb = tex.data[ti + 2];
    if (q.tint != null) { r = r * ((q.tint >> 16) & 255) / 255; g = g * ((q.tint >> 8) & 255) / 255; bb = bb * (q.tint & 255) / 255; }
    r *= q.shade; g *= q.shade; bb *= q.shade;
    const o = i * 4;
    if (al >= 0.99) { color[o] = r; color[o + 1] = g; color[o + 2] = bb; color[o + 3] = 1; depth[i] = Math.max(depth[i], z); }
    else { // translucent: blend over
      const da = color[o + 3], na = al + da * (1 - al);
      color[o] = (r * al + color[o] * da * (1 - al)) / na; color[o + 1] = (g * al + color[o + 1] * da * (1 - al)) / na;
      color[o + 2] = (bb * al + color[o + 2] * da * (1 - al)) / na; color[o + 3] = na;
    }
  }
}
