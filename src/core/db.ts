import type { Db, DbFarm, DbGroup, DbItem, Lang, Recipe, UserOverrides } from './types';

export interface RawDb {
  items: DbItem[];
  groups: DbGroup[];
  farms: DbFarm[];
  recipes: Record<string, Recipe>;
  langIndex: Record<string, string>;
  overrides?: UserOverrides;
}

export function buildDb(raw: RawDb): Db {
  const overrides: UserOverrides = raw.overrides ?? { items: {}, groups: [] };
  const groups = new Map(raw.groups.map(g => [g.id, g]));
  for (const g of overrides.groups) groups.set(g.id, g);
  const items = new Map(raw.items.map(i => [i.id, i]));
  const langIndex = { ...raw.langIndex };
  for (const [id, o] of Object.entries(overrides.items)) {
    items.set(id, { id, en: o.name, vi: o.vi ?? null, stack: o.stack ?? 64, group: o.group });
    langIndex[norm(o.name)] = id;
  }
  const baseSet = new Set<string>();
  for (const g of groups.values()) g.base.forEach(b => baseSet.add(b));
  return { items, groups, farms: new Map(raw.farms.map(f => [f.id, f])), recipes: raw.recipes, langIndex, baseSet, overrides };
}

export const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');

/** Strip Vietnamese diacritics for search. */
export const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

/** Resolve an EN or VI display name to an item id. */
export function resolveItemId(db: Db, name: string): string | null {
  return db.langIndex[norm(name)] ?? null;
}

export function itemName(db: Db, key: string, rawName: string, lang: Lang): { main: string; sub?: string } {
  const it = db.items.get(key);
  const en = it?.en ?? rawName;
  const vi = it?.vi ?? en;
  if (lang === 'en') return { main: en };
  if (lang === 'vi') return { main: vi };
  return { main: en, sub: vi !== en ? vi : undefined };
}

export function groupName(g: DbGroup, lang: Lang): { main: string; sub?: string } {
  if (lang === 'en') return { main: g.en };
  if (lang === 'vi') return { main: g.vi };
  return { main: g.en, sub: g.vi !== g.en ? g.vi : undefined };
}

export function farmName(f: DbFarm, lang: Lang): string {
  return lang === 'vi' ? f.vi : f.en;
}

export const slug = (s: string) => fold(s).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
