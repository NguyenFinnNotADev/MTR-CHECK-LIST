// Farm plan (B4 + B5) and history snapshots.
import { rawMaterials } from './raw';
import { missingQty } from './state';
import type { Db, GameMap, HistoryPoint, Project } from './types';

export interface FarmNeedItem { projectId: string; projectName: string; key: string; name: string; missing: number }
export interface FarmPlan {
  farmId: string;
  owned: boolean;
  units: number; // total base units still needed
  raw: Map<string, number>; // base item → qty
  items: FarmNeedItem[];
  projects: Set<string>;
}

/** Which farms produce a base (leaf) item. */
export function farmsForLeaf(db: Db, leaf: string): string[] {
  const it = db.items.get(leaf);
  if (!it) return [];
  const g = db.groups.get(it.group);
  if (!g) return [];
  if (g.derived) return it.farmable ? it.farms ?? [] : [];
  return g.farms;
}

/** Aggregate what every not-done item of every build on `map` still needs, per farm. */
export function buildFarmPlan(db: Db, projects: Project[], map: GameMap): FarmPlan[] {
  const owned = new Set(map.ownedFarms);
  const plans = new Map<string, FarmPlan>();
  const get = (id: string) => {
    let p = plans.get(id);
    if (!p) { p = { farmId: id, owned: owned.has(id), units: 0, raw: new Map(), items: [], projects: new Set() }; plans.set(id, p); }
    return p;
  };
  for (const pr of projects) {
    if (pr.mapId !== map.id) continue;
    for (const it of pr.items) {
      if (it.status === 'done' || !db.items.has(it.key)) continue;
      const miss = missingQty(it);
      if (miss <= 0) continue;
      const raws = rawMaterials(db, it.key, miss);
      if (!raws.size) raws.set(it.key, miss);
      const touched = new Set<string>();
      for (const [leaf, qty] of raws) {
        for (const f of farmsForLeaf(db, leaf)) {
          const p = get(f);
          p.units += qty;
          p.raw.set(leaf, (p.raw.get(leaf) ?? 0) + qty);
          p.projects.add(pr.id);
          if (!touched.has(f)) {
            touched.add(f);
            p.items.push({ projectId: pr.id, projectName: pr.name, key: it.key, name: it.name, missing: miss });
          }
        }
      }
    }
  }
  return [...plans.values()].sort((a, b) => b.units - a.units);
}

export const today = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Replace/append today's snapshot (only when it changed). */
export function withHistory(p: Project, date = today()): Project {
  const point: HistoryPoint = {
    date,
    doneTypes: p.items.filter(i => i.status === 'done').length,
    totalTypes: p.items.length,
    missingQty: p.items.reduce((s, i) => s + missingQty(i), 0),
  };
  const h = p.history ?? [];
  const last = h[h.length - 1];
  if (last && last.date === date) {
    if (last.doneTypes === point.doneTypes && last.missingQty === point.missingQty) return p;
    return { ...p, history: [...h.slice(0, -1), point] };
  }
  if (last && last.doneTypes === point.doneTypes && last.missingQty === point.missingQty && last.totalTypes === point.totalTypes) return p;
  return { ...p, history: [...h, point] };
}
