import { fold, groupName, itemName } from './db';
import { addInto, rawMaterials } from './raw';
import { missingQty } from './state';
import type { Db, DbGroup, GameMap, Lang, Project, ProjectItem, SortMode, Status } from './types';

export interface ViewGroup {
  key: string; // group id, plus "#nf" for the non-farmable half of a derived group
  group: DbGroup;
  farmable: boolean;
  farms: string[];
  ownedFarms: string[];
  items: ProjectItem[];
  totalQty: number;
}
export interface View {
  missing: { farmable: ViewGroup[]; nonFarmable: ViewGroup[]; unclassified: ProjectItem[] };
  owned: ViewGroup[];
  ownedCount: number;
  doneTypes: number;
  totalTypes: number;
  missingQty: number;
  /** counts of what is currently shown (after search / filter) */
  visibleMissingTypes: number;
  visibleMissingQty: number;
}

const UNKNOWN_GROUP: DbGroup = { id: '?', en: 'Unclassified', vi: 'Chưa phân loại', farms: [], derived: false, base: [], howTo: null };

function itemFarm(db: Db, it: ProjectItem): { group: DbGroup; farmable: boolean; farms: string[] } | null {
  const d = db.items.get(it.key);
  if (!d) return null;
  const g = db.groups.get(d.group) ?? UNKNOWN_GROUP;
  if (g.derived) return { group: g, farmable: !!d.farmable, farms: d.farms ?? [] };
  return { group: g, farmable: g.farms.length > 0, farms: g.farms };
}

export function matchesSearch(db: Db, it: ProjectItem, q: string): boolean {
  if (!q) return true;
  const f = fold(q);
  const d = db.items.get(it.key);
  return [it.name, d?.en, d?.vi].some(s => s && fold(s).includes(f));
}

function buildGroups(db: Db, items: ProjectItem[], map: GameMap | undefined): Map<string, ViewGroup> {
  const owned = new Set(map?.ownedFarms ?? []);
  const out = new Map<string, ViewGroup>();
  for (const it of items) {
    const f = itemFarm(db, it);
    if (!f) continue;
    const key = f.group.derived && !f.farmable ? `${f.group.id}#nf` : f.group.id;
    let vg = out.get(key);
    if (!vg) {
      vg = { key, group: f.group, farmable: f.farmable, farms: [], ownedFarms: [], items: [], totalQty: 0 };
      out.set(key, vg);
    }
    for (const fid of f.farms) if (!vg.farms.includes(fid)) vg.farms.push(fid);
    vg.items.push(it);
    vg.totalQty += it.total;
  }
  for (const vg of out.values()) vg.ownedFarms = vg.farms.filter(f => owned.has(f));
  return out;
}

const statusRank = (s: Status) => (s === 'collecting' ? 0 : s === 'none' ? 1 : 2);

export function sortView(db: Db, groups: ViewGroup[], mode: SortMode, reverse: boolean, lang: Lang): ViewGroup[] {
  const nameOf = (g: ViewGroup) => groupName(g.group, lang).main;
  const cmp = (a: ViewGroup, b: ViewGroup) => {
    if (mode === 'farm') {
      const o = Number(b.ownedFarms.length > 0) - Number(a.ownedFarms.length > 0);
      if (o) return o;
      return b.items.length - a.items.length || b.totalQty - a.totalQty || nameOf(a).localeCompare(nameOf(b));
    }
    if (mode === 'qty') return b.totalQty - a.totalQty || nameOf(a).localeCompare(nameOf(b));
    return nameOf(a).localeCompare(nameOf(b), lang === 'en' ? 'en' : 'vi');
  };
  const itemCmp = (a: ProjectItem, b: ProjectItem) => {
    if (mode === 'name') {
      const na = itemName(db, a.key, a.name, lang).main, nb = itemName(db, b.key, b.name, lang).main;
      return na.localeCompare(nb, lang === 'en' ? 'en' : 'vi');
    }
    return b.total - a.total;
  };
  const sign = reverse ? -1 : 1;
  for (const g of groups)
    g.items.sort((a, b) => statusRank(a.status) - statusRank(b.status) || sign * itemCmp(a, b));
  return groups.sort((a, b) => sign * cmp(a, b));
}

export function buildView(
  db: Db, p: Project, map: GameMap | undefined,
  opts: { sort: SortMode; reverse: boolean; lang: Lang; search: string; filter: Status | 'all' },
): View {
  const visible = p.items.filter(it => matchesSearch(db, it, opts.search) && (opts.filter === 'all' || it.status === opts.filter));
  const notDone = visible.filter(i => i.status !== 'done');
  const done = visible.filter(i => i.status === 'done');
  const missingGroups = sortView(db, [...buildGroups(db, notDone, map).values()], opts.sort, opts.reverse, opts.lang);
  const ownedGroups = sortView(db, [...buildGroups(db, done, map).values()], opts.sort, opts.reverse, opts.lang);
  return {
    missing: {
      farmable: missingGroups.filter(g => g.farmable),
      nonFarmable: missingGroups.filter(g => !g.farmable),
      unclassified: notDone.filter(i => !db.items.has(i.key)),
    },
    owned: ownedGroups,
    ownedCount: done.length,
    doneTypes: p.items.filter(i => i.status === 'done').length,
    totalTypes: p.items.length,
    missingQty: p.items.reduce((s, i) => s + missingQty(i), 0),
    visibleMissingTypes: notDone.length,
    visibleMissingQty: notDone.reduce((s, i) => s + missingQty(i), 0),
  };
}

/** Raw base totals for a group: needed (whole totals) and still missing. */
export function groupRawTotals(db: Db, items: ProjectItem[]) {
  const need = new Map<string, number>(), miss = new Map<string, number>();
  for (const it of items) {
    if (!db.items.has(it.key)) continue;
    addInto(need, rawMaterials(db, it.key, it.total));
    addInto(miss, rawMaterials(db, it.key, missingQty(it)));
  }
  return { need, miss };
}

export const projectProgress = (p: Project) =>
  p.items.length ? p.items.filter(i => i.status === 'done').length / p.items.length : 0;
