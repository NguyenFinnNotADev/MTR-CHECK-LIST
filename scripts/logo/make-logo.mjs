// Redraw the source character as true 128x128 pixel art.
// Each output pixel = one block of the source, coloured by the block's dominant colour
// (dark outlines win when they cover enough of the block), then the palette is reduced
// with k-means so it reads as hand-made pixel art. Writes logo-<name>.png + 4x preview.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const dir = path.resolve('docs/logo');
const src = PNG.sync.read(fs.readFileSync(path.join(dir, 'source.png')));
const { width: W, data: S } = src;
const N = 128;

const VARIANTS = {
  bust: { x: 76, y: 52, size: 776 },   // head + headphones + thumb
  mid: { x: 36, y: 48, size: 816 },    // full thumb, still close on the face
  wide: { x: 0, y: 0, size: 896 },     // more hoodie, same framing as the source
};
const results = {};

const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

function sample({ x, y, size }) {
  const out = new Float32Array(N * N * 3);
  const step = size / N;
  for (let oy = 0; oy < N; oy++) for (let ox = 0; ox < N; ox++) {
    // inner 80% of the block so neighbouring pixels don't bleed in
    const x0 = Math.floor(x + ox * step + step * 0.1), x1 = Math.ceil(x + (ox + 1) * step - step * 0.1);
    const y0 = Math.floor(y + oy * step + step * 0.1), y1 = Math.ceil(y + (oy + 1) * step - step * 0.1);
    const buckets = new Map();
    let dark = 0, total = 0, dr = 0, dg = 0, db = 0;
    for (let sy = y0; sy < y1; sy++) for (let sx = x0; sx < x1; sx++) {
      const i = (sy * W + sx) * 4, r = S[i], g = S[i + 1], b = S[i + 2];
      total++;
      if (lum(r, g, b) < 34) { dark++; dr += r; dg += g; db += b; }
      const k = (r >> 3) << 10 | (g >> 3) << 5 | (b >> 3);
      const e = buckets.get(k) || { n: 0, r: 0, g: 0, b: 0 };
      e.n++; e.r += r; e.g += g; e.b += b; buckets.set(k, e);
    }
    let c;
    if (dark / total >= 0.38) c = [dr / dark, dg / dark, db / dark];
    else {
      // merge near buckets: score each bucket by itself + neighbours within 1 step
      let best = null, bestScore = -1;
      for (const [k, e] of buckets) {
        const kr = k >> 10, kg = (k >> 5) & 31, kb = k & 31;
        let score = 0;
        for (const [k2, e2] of buckets) {
          if (Math.abs((k2 >> 10) - kr) <= 1 && Math.abs(((k2 >> 5) & 31) - kg) <= 1 && Math.abs((k2 & 31) - kb) <= 1) score += e2.n;
        }
        if (score > bestScore) { bestScore = score; best = e; }
      }
      c = [best.r / best.n, best.g / best.n, best.b / best.n];
    }
    out.set(c, (oy * N + ox) * 3);
  }
  return out;
}

function kmeans(px, k) {
  // init: pick colours spread by luminance + hue (farthest-point)
  const n = px.length / 3;
  const cent = [[px[0], px[1], px[2]]];
  const d2 = (i, c) => (px[i * 3] - c[0]) ** 2 + (px[i * 3 + 1] - c[1]) ** 2 + (px[i * 3 + 2] - c[2]) ** 2;
  while (cent.length < k) {
    let far = 0, farD = -1;
    for (let i = 0; i < n; i++) {
      let m = Infinity; for (const c of cent) m = Math.min(m, d2(i, c));
      if (m > farD) { farD = m; far = i; }
    }
    cent.push([px[far * 3], px[far * 3 + 1], px[far * 3 + 2]]);
  }
  const lab = new Uint8Array(n);
  for (let it = 0; it < 20; it++) {
    const acc = cent.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < n; i++) {
      let b = 0, bd = Infinity;
      for (let j = 0; j < k; j++) { const d = d2(i, cent[j]); if (d < bd) { bd = d; b = j; } }
      lab[i] = b; const a = acc[b]; a[0] += px[i * 3]; a[1] += px[i * 3 + 1]; a[2] += px[i * 3 + 2]; a[3]++;
    }
    acc.forEach((a, j) => { if (a[3]) cent[j] = [a[0] / a[3], a[1] / a[3], a[2] / a[3]]; });
  }
  return { cent: cent.map(c => c.map(Math.round)), lab };
}

// remove lone pixels (a pixel unlike all 4 neighbours that agree with each other)
function despeckle(lab) {
  const o = Uint8Array.from(lab);
  for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
    const i = y * N + x, nb = [lab[i - 1], lab[i + 1], lab[i - N], lab[i + N]];
    if (!nb.includes(lab[i])) {
      const cnt = {}; nb.forEach(v => cnt[v] = (cnt[v] || 0) + 1);
      const [v, c] = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
      if (c >= 3) o[i] = +v;
    }
  }
  return o;
}

function write(file, rgb, scale) {
  const png = new PNG({ width: N * scale, height: N * scale });
  for (let y = 0; y < N * scale; y++) for (let x = 0; x < N * scale; x++) {
    const s = (Math.floor(y / scale) * N + Math.floor(x / scale)) * 3, d = (y * N * scale + x) * 4;
    png.data[d] = rgb[s]; png.data[d + 1] = rgb[s + 1]; png.data[d + 2] = rgb[s + 2]; png.data[d + 3] = 255;
  }
  fs.writeFileSync(file, PNG.sync.write(png));
}

for (const [name, crop] of Object.entries(VARIANTS)) {
  const px = sample(crop);
  const { cent, lab } = kmeans(px, 30);
  const clean = despeckle(lab);
  const rgb = new Uint8Array(N * N * 3);
  clean.forEach((l, i) => rgb.set(cent[l], i * 3));
  write(path.join(dir, `logo-${name}.png`), rgb, 1);
  write(path.join(dir, `logo-${name}-x4.png`), rgb, 4);
  results[name] = rgb;
  console.log(name, 'palette', cent.length);
}

// comparison sheet: each variant at 3x, plus downscaled 48 / 32 px (box filter) as taskbar sizes
{
  const names = Object.keys(results), pad = 24, big = N * 3;
  const SW = pad + names.length * (big + pad), SH = pad + big + pad + 48 + pad;
  const sheet = new PNG({ width: SW, height: SH });
  for (let i = 0; i < SW * SH; i++) sheet.data.set([40, 36, 32, 255], i * 4);
  const put = (x, y, r, g, b) => sheet.data.set([r, g, b, 255], (y * SW + x) * 4);
  names.forEach((name, k) => {
    const rgb = results[name], ox = pad + k * (big + pad);
    for (let y = 0; y < big; y++) for (let x = 0; x < big; x++) {
      const s = (Math.floor(y / 3) * N + Math.floor(x / 3)) * 3; put(ox + x, pad + y, rgb[s], rgb[s + 1], rgb[s + 2]);
    }
    let sx = ox;
    for (const t of [48, 32]) {
      const f = N / t;
      for (let y = 0; y < t; y++) for (let x = 0; x < t; x++) {
        let r = 0, g = 0, b = 0, c = 0;
        for (let yy = Math.floor(y * f); yy < Math.floor((y + 1) * f); yy++) for (let xx = Math.floor(x * f); xx < Math.floor((x + 1) * f); xx++) {
          const s = (yy * N + xx) * 3; r += rgb[s]; g += rgb[s + 1]; b += rgb[s + 2]; c++;
        }
        put(sx + x, pad * 2 + big + y, r / c, g / c, b / c);
      }
      sx += t + pad;
    }
  });
  fs.writeFileSync(path.join(dir, 'logo-compare.png'), PNG.sync.write(sheet));
}
