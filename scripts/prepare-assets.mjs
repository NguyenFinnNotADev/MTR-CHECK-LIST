// Copies the parts of the vanilla template + game jar we need into _source/mc-assets.
// Usage: node scripts/prepare-assets.mjs [--delete-template]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.resolve(SRC, '..');
const TEMPLATE = path.join(APP, '26.3.x-Template', 'assets', 'minecraft');
const OUT = path.join(SRC, 'mc-assets');
const MODRINTH = path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'), 'ModrinthApp', 'meta');
const VERSION = process.env.MC_VERSION_DIR ?? '1.21.11-0.18.6';
const JAR = path.join(MODRINTH, 'versions', VERSION, `${VERSION}.jar`);

const log = (...a) => console.log('[prepare]', ...a);

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  let n = 0;
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) n += copyDir(a, b);
    else { fs.copyFileSync(a, b); n++; }
  }
  return n;
}

function countFiles(dir) {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true }))
    n += e.isDirectory() ? countFiles(path.join(dir, e.name)) : 1;
  return n;
}

// 1. template assets (icons source)
const parts = ['items', 'models', 'textures/block', 'textures/item', 'textures/entity'];
if (fs.existsSync(TEMPLATE)) {
  for (const p of parts) {
    const n = copyDir(path.join(TEMPLATE, p), path.join(OUT, 'template', p));
    log(`template/${p}: ${n} files`);
  }
} else log('template not found (already prepared?) — skipping copy');

// 2. jar: recipes, en_us, items/models/textures of the exact game version (fallback for icons)
if (!fs.existsSync(JAR)) throw new Error(`Game jar not found: ${JAR}`);
const jarOut = path.join(OUT, 'jar');
fs.mkdirSync(jarOut, { recursive: true });
execFileSync('tar', ['-xf', JAR, '-C', jarOut,
  'data/minecraft/recipe', 'data/minecraft/tags/item',
  'assets/minecraft/lang/en_us.json', 'assets/minecraft/items',
  'assets/minecraft/models', 'assets/minecraft/textures/block', 'assets/minecraft/textures/item',
  'assets/minecraft/textures/entity']);
log('jar extracted:', countFiles(jarOut), 'files');

// 3. vi_vn.json from the asset index of this version
const verJson = JSON.parse(fs.readFileSync(path.join(MODRINTH, 'versions', VERSION, `${VERSION}.json`), 'utf8'));
const idxId = verJson.assetIndex?.id;
const idx = JSON.parse(fs.readFileSync(path.join(MODRINTH, 'assets', 'indexes', `${idxId}.json`), 'utf8'));
const vi = idx.objects['minecraft/lang/vi_vn.json'];
if (!vi) throw new Error('vi_vn.json not in asset index');
fs.mkdirSync(path.join(OUT, 'lang'), { recursive: true });
fs.copyFileSync(path.join(MODRINTH, 'assets', 'objects', vi.hash.slice(0, 2), vi.hash), path.join(OUT, 'lang', 'vi_vn.json'));
fs.copyFileSync(path.join(jarOut, 'assets/minecraft/lang/en_us.json'), path.join(OUT, 'lang', 'en_us.json'));
fs.writeFileSync(path.join(OUT, 'VERSION.txt'), `game=${VERSION}\nassetIndex=${idxId}\ntemplate=26.3.x\nprepared=${new Date().toISOString()}\n`);
log('lang: en_us + vi_vn (index', idxId + ')');

// 4. verify and optionally delete template
const ok = parts.every(p => fs.existsSync(path.join(OUT, 'template', p)) && countFiles(path.join(OUT, 'template', p)) > 0)
  && countFiles(path.join(jarOut, 'data/minecraft/recipe')) > 1000;
log('verify:', ok ? 'OK' : 'FAILED');
if (ok && process.argv.includes('--delete-template') && fs.existsSync(path.join(APP, '26.3.x-Template'))) {
  fs.rmSync(path.join(APP, '26.3.x-Template'), { recursive: true, force: true });
  log('deleted 26.3.x-Template');
}
