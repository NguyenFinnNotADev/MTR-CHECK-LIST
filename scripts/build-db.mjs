// Builds database/*.json from mc-assets (jar 1.21.11 + vi_vn) and curated/catalog.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { farms, groups, extraRecipes, stack1, stack16 } from '../curated/catalog.mjs';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.resolve(SRC, '..');
const MC = path.join(SRC, 'mc-assets');
const JAR = path.join(MC, 'jar');
const OUT = path.join(APP, 'database');
fs.mkdirSync(OUT, { recursive: true });

const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const strip = id => id.replace(/^minecraft:/, '');

const en = readJson(path.join(MC, 'lang', 'en_us.json'));
const vi = readJson(path.join(MC, 'lang', 'vi_vn.json'));

// ---------- items ----------
const itemIds = fs.readdirSync(path.join(JAR, 'assets/minecraft/items'))
  .filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort();

const nameOf = (lang, id) => lang[`block.minecraft.${id}`] ?? lang[`item.minecraft.${id}`] ?? null;
const stackOf = id => stack1.some(r => r.test(id)) ? 1 : stack16.some(r => r.test(id)) ? 16 : 64;

const groupOf = id => groups.find(g => g.match.some(r => r.test(id)));

// ---------- tags ----------
const tagCache = new Map();
function tagFirst(tag) {
  tag = strip(tag);
  if (tagCache.has(tag)) return tagCache.get(tag);
  const p = path.join(JAR, 'data/minecraft/tags/item', `${tag}.json`);
  const all = tagAll(tag);
  const r = all.find(i => /^oak_/.test(i)) ?? all.find(i => i === 'cobblestone') ?? all[0] ?? null;
  tagCache.set(tag, r);
  return r;
}
function tagAll(tag) {
  const p = path.join(JAR, 'data/minecraft/tags/item', `${strip(tag)}.json`);
  if (!fs.existsSync(p)) return [];
  return readJson(p).values.flatMap(v => {
    const s = typeof v === 'string' ? v : v.id;
    return s.startsWith('#') ? tagAll(s.slice(1)) : [strip(s)];
  });
}
function ingredientId(ing) {
  if (Array.isArray(ing)) ing = ing[0];
  if (ing && typeof ing === 'object') ing = ing.item ?? (ing.tag ? '#' + ing.tag : null);
  if (typeof ing !== 'string') return null;
  return ing.startsWith('#') ? tagFirst(ing.slice(1)) : strip(ing);
}

// ---------- recipes ----------
const candidates = new Map(); // out -> [{n, in:{id:count}, how}]
const add = (out, r) => { if (!candidates.has(out)) candidates.set(out, []); candidates.get(out).push(r); };
const recipeDir = path.join(JAR, 'data/minecraft/recipe');
for (const f of fs.readdirSync(recipeDir)) {
  const r = readJson(path.join(recipeDir, f));
  const type = strip(r.type ?? '');
  const out = r.result?.id ? strip(r.result.id) : null;
  if (!out) continue;
  const n = r.result.count ?? 1;
  const inputs = {};
  let ok = true;
  const push = ing => { const id = ingredientId(ing); if (!id) ok = false; else inputs[id] = (inputs[id] ?? 0) + 1; };
  if (type === 'crafting_shaped') {
    for (const row of r.pattern) for (const ch of row) if (ch !== ' ') push(r.key[ch]);
  } else if (type === 'crafting_shapeless') {
    r.ingredients.forEach(push);
  } else if (type === 'stonecutting') {
    push(r.ingredient);
  } else if (type === 'smelting') {
    push(r.ingredient);
  } else continue;
  if (!ok) continue;
  const ins = Object.entries(inputs);
  // skip "unpacking" recipes (block → 9 items) to avoid storage cycles
  if (ins.length === 1 && n === 9 && ins[0][1] === 1) continue;
  if (ins.some(([id]) => id === out)) continue;
  add(out, { n, in: inputs, how: type === 'stonecutting' ? 'stonecutter' : type === 'smelting' ? 'smelt' : 'craft', src: f.slice(0, -5) });
}
for (const r of extraRecipes) add(r.out, { n: r.n, in: r.in, how: r.how, src: 'extra' });

// ---------- base set ----------
const allDyes = itemIds.filter(i => i.endsWith('_dye'));
const allWool = itemIds.filter(i => i.endsWith('_wool'));
const groupItems = new Map(groups.map(g => [g.id, []]));
for (const id of itemIds) { const g = groupOf(id); if (g) groupItems.get(g.id).push(id); }
const expandBase = (g, b) => b === 'dyes' ? allDyes : b === 'wool' ? allWool : b === 'plants' ? groupItems.get('plants') : [b];
const baseSet = new Set();
const baseGroup = new Map(); // base item -> group id
for (const g of groups) for (const b of g.base ?? []) for (const id of expandBase(g, b)) {
  baseSet.add(id); if (!baseGroup.has(id)) baseGroup.set(id, g.id);
}

// ---------- choose cheapest recipe per item (in base units) ----------
const cost = new Map(), chosen = new Map(), busy = new Set();
function costOf(id) {
  if (baseSet.has(id) || !candidates.has(id)) return 1;
  if (cost.has(id)) return cost.get(id);
  if (busy.has(id)) return Infinity;
  busy.add(id);
  let best = Infinity, pick = null;
  for (const r of candidates.get(id)) {
    let c = 0;
    for (const [i, k] of Object.entries(r.in)) c += k * costOf(i);
    c /= r.n;
    const extraSteps = Object.keys(r.in).filter(i => !baseSet.has(i) && candidates.has(i)).length;
    const rank = c + (r.how === 'stonecutter' ? -1e-6 : 0) + extraSteps * 1e-4;
    if (rank < best) { best = rank; pick = r; }
  }
  busy.delete(id);
  if (!pick) best = 1;
  cost.set(id, best);
  if (pick) chosen.set(id, pick);
  return best;
}
itemIds.forEach(costOf);

// raw leaves of an item (for derived farmability)
function leaves(id, seen = new Set()) {
  if (seen.has(id)) return [];
  seen.add(id);
  const r = chosen.get(id);
  if (baseSet.has(id) || !r) return [id];
  return Object.keys(r.in).flatMap(i => leaves(i, seen));
}

// ---------- outputs ----------
const farmById = new Map(farms.map(f => [f.id, f]));
const groupById = new Map(groups.map(g => [g.id, g]));

const items = itemIds.map(id => {
  const g = groupOf(id) ?? groupById.get('crafted');
  const o = { id, en: nameOf(en, id), vi: nameOf(vi, id), stack: stackOf(id), group: g.id };
  if (g.derived) {
    const ls = [...new Set(leaves(id))];
    const fs_ = new Set();
    let farmable = ls.length > 0;
    for (const l of ls) {
      const lg = groupById.get(baseGroup.get(l) ?? groupOf(l)?.id);
      if (!lg || lg.derived || !(lg.farms?.length)) { farmable = false; continue; }
      lg.farms.forEach(f => fs_.add(f));
    }
    o.farmable = farmable;
    o.farms = [...fs_];
  }
  return o;
}).filter(i => i.en);

const recipes = {};
for (const [id, r] of chosen) recipes[id] = { n: r.n, in: r.in, how: r.how };

const outGroups = groups.map(g => ({
  id: g.id, en: g.en, vi: g.vi, farms: g.farms ?? [], derived: !!g.derived,
  base: [...new Set((g.base ?? []).flatMap(b => expandBase(g, b)))],
  howTo: g.howTo ?? null,
}));

const langIndex = {};
for (const i of items) {
  for (const n of [i.en, i.vi]) if (n) { const k = n.toLowerCase().trim(); if (!(k in langIndex)) langIndex[k] = i.id; }
}

const write = (name, data) => fs.writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 1));
write('items.json', items);
write('groups.json', outGroups);
write('farms.json', farms.map(f => ({ id: f.id, en: f.en, vi: f.vi, produces: f.produces })));
write('recipes.json', recipes);
write('lang_index.json', langIndex);
if (!fs.existsSync(path.join(OUT, 'user_overrides.json'))) write('user_overrides.json', { items: {}, groups: [] });
write('meta.json', { game: fs.readFileSync(path.join(MC, 'VERSION.txt'), 'utf8').trim(), built: new Date().toISOString(), items: items.length });

console.log(`[db] items ${items.length}, recipes ${Object.keys(recipes).length}, groups ${outGroups.length}, farms ${farms.length}`);
for (const id of ['stripped_spruce_wood', 'spruce_stairs', 'black_concrete', 'deepslate_tile_stairs', 'stone_stairs', 'waxed_weathered_cut_copper_slab', 'torch', 'campfire'])
  console.log('  ', id, JSON.stringify(recipes[id] ?? null), 'cost', cost.get(id)?.toFixed?.(3) ?? 1);
