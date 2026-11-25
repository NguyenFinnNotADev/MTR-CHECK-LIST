// Find the pixel-art grid size of the source image (lowest within-cell colour variance).
import fs from 'node:fs';
import { PNG } from 'pngjs';

const img = PNG.sync.read(fs.readFileSync(process.argv[2]));
const { width: W, height: H, data } = img;
console.log('size', W, H);
for (const g of [6, 6.5, 7, 7.5, 8, 9.375]) {
  for (const off of [0, Math.floor(g / 2)]) {
    let v = 0, n = 0;
    for (let cy = 0; cy + g <= H; cy += g) for (let cx = 0; cx + g <= W; cx += g) {
      const x0 = Math.round(cx + off) , y0 = Math.round(cy + off);
      if (x0 + g > W || y0 + g > H) continue;
      let s = [0, 0, 0], s2 = 0, k = 0;
      for (let y = y0 + 1; y < y0 + g - 1; y++) for (let x = x0 + 1; x < x0 + g - 1; x++) {
        const i = (Math.floor(y) * W + Math.floor(x)) * 4;
        for (let c = 0; c < 3; c++) s[c] += data[i + c];
        s2 += data[i] ** 2 + data[i + 1] ** 2 + data[i + 2] ** 2; k++;
      }
      if (!k) continue;
      v += s2 / k - (s[0] ** 2 + s[1] ** 2 + s[2] ** 2) / k / k; n++;
    }
    console.log(`grid ${g} off ${off}: mean in-cell variance ${(v / n).toFixed(1)}`);
  }
}
