// App logo = docs/logo/logo-mid.png (128px pixel art made by scripts/logo/make-logo.mjs).
// Adds pixel-stepped rounded corners, then writes:
//   public/logo.png          128px, used by the sidebar brand + boot splash
//   src-tauri/app-icon.png   1024px (nearest x8), source for `npx tauri icon`
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const logo = PNG.sync.read(fs.readFileSync(path.join(SRC, 'docs', 'logo', 'logo-mid.png')));
const N = logo.width, R = 14; // corner radius in logo pixels

const inside = (x, y) => {
  const cx = x + 0.5, cy = y + 0.5;
  const dx = Math.max(0, Math.abs(cx - N / 2) - (N / 2 - R)), dy = Math.max(0, Math.abs(cy - N / 2) - (N / 2 - R));
  return dx * dx + dy * dy <= R * R;
};
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) logo.data[(y * N + x) * 4 + 3] = inside(x, y) ? 255 : 0;

fs.mkdirSync(path.join(SRC, 'public'), { recursive: true });
fs.writeFileSync(path.join(SRC, 'public', 'logo.png'), PNG.sync.write(logo));

const S = 1024, k = S / N, out = new PNG({ width: S, height: S });
for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
  const s = (Math.floor(y / k) * N + Math.floor(x / k)) * 4;
  out.data.set(logo.data.subarray(s, s + 4), (y * S + x) * 4);
}
fs.writeFileSync(path.join(SRC, 'src-tauri', 'app-icon.png'), PNG.sync.write(out));
console.log('public/logo.png + src-tauri/app-icon.png written');
