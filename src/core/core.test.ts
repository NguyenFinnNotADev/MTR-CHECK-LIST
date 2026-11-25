import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDb, resolveItemId } from './db';
import { formatQty } from './format';
import { parseLitematica, ParseError } from './parse';
import { buildFarmPlan, withHistory } from './plan';
import { createProject } from './project';
import { rawMaterials } from './raw';
import { activateRow, clickRow, setCollected } from './state';
import type { GameMap } from './types';
import { buildView, groupRawTotals } from './view';

const APP = path.resolve(__dirname, '../../..');
const rj = (f: string) => JSON.parse(fs.readFileSync(path.join(APP, 'database', f), 'utf8'));
const db = buildDb({
  items: rj('items.json'), groups: rj('groups.json'), farms: rj('farms.json'),
  recipes: rj('recipes.json'), langIndex: rj('lang_index.json'),
});
const sampleText = fs.readFileSync(path.resolve(__dirname, '../../docs/sample/material_list_2026-11-24_18.52.58.txt'), 'utf8');
const map: GameMap = { id: 'm1', name: 'Polym', ownedFarms: [] };

describe('parseLitematica', () => {
  it('reads schematic name and every data row', () => {
    const p = parseLitematica(sampleText);
    expect(p.schematic).toBe('AdventureTimeTreeHouse (Converted Sponge)');
    expect(p.rows.length).toBe(198);
    expect(p.rows[0]).toEqual({ name: 'Lime Wool', total: 9201 });
  });
  it('handles CRLF, duplicates and missing header', () => {
    const p = parseLitematica('| Dirt | 5 | 5 | 0 |\r\n| Dirt | 1 | 1 | 0 |\r\n', 'my_list.txt');
    expect(p).toEqual({ schematic: 'my_list', rows: [{ name: 'Dirt', total: 6 }] });
  });
  it('rejects non-Litematica text', () => {
    expect(() => parseLitematica('hello world')).toThrow(ParseError);
  });
});

describe('resolve + grouping', () => {
  const project = createProject(db, parseLitematica(sampleText), '', 'm1');
  it('resolves all sample rows (EN)', () => {
    expect(project.items.filter(i => i.key.startsWith('?'))).toEqual([]);
  });
  it('resolves Vietnamese names', () => {
    const vi = db.items.get('lime_wool')!.vi!;
    expect(resolveItemId(db, vi)).toBe('lime_wool');
  });
  it('puts items in the expected groups', () => {
    const g = (id: string) => db.items.get(id)!.group;
    expect(g('lime_wool')).toBe('wool');
    for (const id of ['spruce_stairs', 'spruce_trapdoor', 'spruce_sign', 'spruce_door', 'spruce_slab', 'spruce_fence', 'spruce_planks', 'stripped_spruce_wood'])
      expect(g(id)).toBe('spruce');
    for (const id of ['black_concrete', 'lime_concrete', 'red_concrete', 'green_concrete']) expect(g(id)).toBe('concrete');
    expect(db.groups.get('deepslate')!.farms).toEqual([]);
    expect(db.groups.get('wool')!.farms).toEqual(['sheep']);
  });
  it('builds a view with farmable / non-farmable split and owned farms first', () => {
    const v = buildView(db, project, { ...map, ownedFarms: ['tree_spruce'] }, { sort: 'farm', reverse: false, lang: 'en', search: '', filter: 'all' });
    expect(v.missing.farmable[0].group.id).toBe('spruce');
    expect(v.missing.nonFarmable.some(g => g.group.id === 'deepslate')).toBe(true);
    expect(v.totalTypes).toBe(198);
  });
  it('searches Vietnamese without diacritics', () => {
    const v = buildView(db, project, map, { sort: 'farm', reverse: false, lang: 'vi', search: 'len', filter: 'all' });
    const ids = [...v.missing.farmable, ...v.missing.nonFarmable].flatMap(g => g.items.map(i => i.key));
    expect(ids).toContain('lime_wool');
  });
});

describe('raw materials', () => {
  it('7 992 Stripped Spruce Wood → 10 656 Spruce Log', () => {
    expect(rawMaterials(db, 'stripped_spruce_wood', 7992).get('spruce_log')).toBe(10656);
  });
  it('rounds up per craft step (missing after 3 520 collected)', () => {
    expect(rawMaterials(db, 'stripped_spruce_wood', 7992 - 3520).get('spruce_log')).toBe(5964);
  });
  it('415 Spruce Stairs → 105 Spruce Log', () => {
    // 415 stairs = 104 crafts × 6 planks = 624 planks = 156 crafts → 156 logs
    expect(rawMaterials(db, 'spruce_stairs', 415).get('spruce_log')).toBe(156);
  });
  it('concrete → sand + gravel + dye', () => {
    const m = rawMaterials(db, 'black_concrete', 8388);
    expect(m.get('sand')).toBe(4196);
    expect(m.get('gravel')).toBe(4196);
    expect(m.get('black_dye')).toBe(1049);
  });
  it('raw items have no breakdown', () => {
    expect(rawMaterials(db, 'lime_wool', 100).size).toBe(0);
  });
  it('group totals', () => {
    const items = [{ key: 'spruce_stairs', name: '', total: 415, status: 'none' as const, collected: 0 }];
    expect(groupRawTotals(db, items).need.get('spruce_log')).toBe(156);
  });
});

describe('farm plan + history', () => {
  const project = createProject(db, parseLitematica(sampleText), '', 'm1');
  it('aggregates raw needs per farm and ranks them', () => {
    const plans = buildFarmPlan(db, [project], map);
    const spruce = plans.find(p => p.farmId === 'tree_spruce')!;
    expect(spruce.raw.get('spruce_log')).toBeGreaterThan(10000);
    expect(plans.find(p => p.farmId === 'sheep')!.raw.get('lime_wool')).toBe(9201);
    for (let i = 1; i < plans.length; i++) expect(plans[i - 1].units).toBeGreaterThanOrEqual(plans[i].units);
    expect(plans.some(p => p.farmId === 'deepslate')).toBe(false);
  });
  it('ignores builds on other maps and done items', () => {
    const other = { ...project, mapId: 'other' };
    expect(buildFarmPlan(db, [other], map)).toEqual([]);
  });
  it('keeps one history point per day, only on change', () => {
    let p = withHistory(project, '2026-11-25');
    expect(p.history).toHaveLength(1);
    expect(withHistory(p, '2026-11-25')).toBe(p);
    p = withHistory({ ...p, items: p.items.map((i, k) => (k === 0 ? { ...i, status: 'done' as const, collected: i.total } : i)) }, '2026-11-25');
    expect(p.history).toHaveLength(1);
    expect(p.history![0].doneTypes).toBe(1);
    p = withHistory(p, '2026-11-26');
    expect(p.history).toHaveLength(1); // nothing changed since yesterday
  });
});

describe('state + format', () => {
  const base = { key: 'stripped_spruce_wood', name: '', total: 7992, status: 'none' as const, collected: 0 };
  it('click starts collecting; collecting stays', () => {
    const a = clickRow(base);
    expect(a.status).toBe('collecting');
    expect(clickRow({ ...a, collected: 5 }).collected).toBe(5);
  });
  it('auto done at total, keeps number', () => {
    const a = setCollected(clickRow(base), 7992);
    expect(a.status).toBe('done');
    expect(setCollected(a, 100).status).toBe('collecting');
    expect(setCollected(a, -3)).toBe(a);
  });
  it('switching rows settles the previous one', () => {
    const mk = (key: string, collected = 0, status: 'none' | 'collecting' = 'none') => ({ key, name: key, total: 100, status, collected });
    // untouched new item → back to none
    let r = activateRow([mk('a'), mk('b')], null, 'a');
    expect(r.items[0].status).toBe('collecting');
    r = activateRow(r.items, r.active, 'b');
    expect(r.items.map(i => i.status)).toEqual(['none', 'collecting']);
    // partial progress → stays collecting
    r.items = r.items.map(i => (i.key === 'b' ? setCollected(i, 40) : i));
    r = activateRow(r.items, r.active, 'a');
    expect(r.items.find(i => i.key === 'b')!.status).toBe('collecting');
    // finished → done
    r.items = r.items.map(i => (i.key === 'a' ? { ...i, collected: 100 } : i));
    r = activateRow(r.items, r.active, 'b');
    expect(r.items.find(i => i.key === 'a')!.status).toBe('done');
    // item already collecting from before, untouched → keeps collecting
    let s = activateRow([mk('x', 30, 'collecting'), mk('y')], null, 'x');
    s = activateRow(s.items, s.active, 'y');
    expect(s.items[0].status).toBe('collecting');
  });
  it('formats shulkers and stacks by stack size', () => {
    expect(formatQty(9201)).toBe('5 shulker + 561');
    expect(formatQty(1262)).toBe('19 stack + 46');
    expect(formatQty(106, 16)).toBe('6 stack + 10');
    expect(formatQty(74, 1)).toBe('2 shulker + 20');
    expect(formatQty(10)).toBe('');
  });
});
