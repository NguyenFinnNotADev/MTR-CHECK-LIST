// Validates database against the sample Litematica file(s) in docs/sample.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.resolve(SRC, '..');
const DB = path.join(APP, 'database');
const rj = f => JSON.parse(fs.readFileSync(path.join(DB, f), 'utf8'));
const items = new Map(rj('items.json').map(i => [i.id, i]));
const groups = new Map(rj('groups.json').map(g => [g.id, g]));
const lang = rj('lang_index.json');

let problems = 0;
const sampleDir = path.join(SRC, 'docs', 'sample');
for (const f of fs.readdirSync(sampleDir).filter(f => f.endsWith('.txt'))) {
  const rows = fs.readFileSync(path.join(sampleDir, f), 'utf8').split(/\r?\n/)
    .map(l => l.split('|').map(s => s.trim())).filter(c => c.length >= 4 && /^\d+$/.test(c[2] ?? ''));
  console.log(`== ${f}: ${rows.length} rows`);
  const byGroup = {};
  for (const c of rows) {
    const name = c[1];
    const id = lang[name.toLowerCase()];
    if (!id) { console.log('  UNRESOLVED', name); problems++; continue; }
    const it = items.get(id);
    const icon = fs.existsSync(path.join(APP, 'icons', `${id}.png`));
    if (!icon && fs.existsSync(path.join(APP, 'icons'))) { console.log('  NO ICON', id); problems++; }
    const g = groups.get(it.group);
    const farm = g.derived ? (it.farmable ? 'derived:' + it.farms.join('+') : 'derived:NO') : (g.farms.join('+') || 'NO-FARM');
    (byGroup[`${g.id} [${farm}]`] ??= []).push(id);
  }
  for (const [g, ids] of Object.entries(byGroup).sort()) console.log(`  ${g}: ${ids.join(', ')}`);
}
for (const g of groups.values()) if (!g.derived && !g.farms.length && !g.howTo) { console.log('  GROUP w/o farm or howTo:', g.id); problems++; }
console.log(problems ? `[validate] ${problems} problem(s)` : '[validate] OK');
process.exitCode = problems ? 1 : 0;
