// Pixel UI icons = flat Minecraft item sprites (1.21.11 jar), scaled 2× nearest-neighbor → <app>/icons/ui/<name>.png
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.resolve(SRC, '..');
const TEX = path.join(SRC, 'mc-assets', 'jar', 'assets', 'minecraft', 'textures', 'item');
const OUT = process.env.UI_ICON_OUT ?? path.join(APP, 'icons', 'ui');
fs.mkdirSync(OUT, { recursive: true });

// ui name → item texture
export const UI_ICONS = {
  pick: 'chest_minecart', materials: 'book', plan: 'wheat', maps: 'map', settings: 'comparator',
  mini: 'spyglass', pin: 'compass_16', note: 'writable_book', raw: 'bundle', history: 'clock_00',
  rename: 'name_tag', duplicate: 'paper', reset: 'recovery_compass_16', delete: 'tnt_minecart', search: 'spyglass',
  main: 'ender_eye', export: 'chest_minecart', import: 'hopper_minecart', folder: 'minecart', farm: 'iron_hoe',
  owned: 'emerald', nofarm: 'barrier', done: 'emerald', missing: 'redstone', sort: 'hopper', warning: 'gunpowder',
  location: 'filled_map', group: 'bundle', theme: 'painting', language: 'oak_sign', animation: 'firework_rocket',
  close: 'barrier', add: 'slime_ball', pickaxe: 'iron_pickaxe', nonfarm: 'flint', unknown: 'knowledge_book',
  build: 'brick', menu: 'stick',
};

let n = 0;
for (const [name, tex] of Object.entries(UI_ICONS)) {
  const f = [path.join(TEX, `${tex}.png`), path.join(SRC, 'mc-assets', 'jar', 'assets', 'minecraft', 'textures', 'block', `${tex}.png`)].find(p => fs.existsSync(p));
  if (!f) { console.warn('[ui-icons] missing', name, tex); continue; }
  const src = PNG.sync.read(fs.readFileSync(f));
  const w = src.width, h = Math.min(src.width, src.height), S = 2;
  const out = new PNG({ width: w * S, height: h * S });
  for (let y = 0; y < h * S; y++) for (let x = 0; x < w * S; x++) {
    const i = (Math.floor(y / S) * w + Math.floor(x / S)) * 4, o = (y * w * S + x) * 4;
    for (let c = 0; c < 4; c++) out.data[o + c] = src.data[i + c];
  }
  fs.writeFileSync(path.join(OUT, `${name}.png`), PNG.sync.write(out));
  n++;
}
console.log(`[ui-icons] ${n} written to ${OUT}`);
