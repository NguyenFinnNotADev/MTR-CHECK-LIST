import type { Db } from './types';

export interface RawNode {
  id: string;
  qty: number;
  how?: string; // how this node is made from its children
  children: RawNode[];
}

/** Recipe tree down to base materials, rounding up crafts at every step. */
export function rawTree(db: Db, id: string, qty: number, depth = 0, seen: Set<string> = new Set()): RawNode {
  const r = db.recipes[id];
  if (qty <= 0 || !r || db.baseSet.has(id) || depth > 12 || seen.has(id)) return { id, qty, children: [] };
  const crafts = Math.ceil(qty / r.n);
  const next = new Set(seen).add(id);
  return {
    id, qty, how: r.how,
    children: Object.entries(r.in).map(([i, k]) => rawTree(db, i, crafts * k, depth + 1, next)),
  };
}

/** Leaf totals of a tree (excluding the root when it is itself a leaf). */
export function leaves(node: RawNode, out: Map<string, number> = new Map()): Map<string, number> {
  if (!node.children.length) out.set(node.id, (out.get(node.id) ?? 0) + node.qty);
  else node.children.forEach(c => leaves(c, out));
  return out;
}

export function isCraftable(db: Db, id: string): boolean {
  return !!db.recipes[id] && !db.baseSet.has(id);
}

/** Base materials needed for `qty` of item; empty map when the item is itself raw. */
export function rawMaterials(db: Db, id: string, qty: number): Map<string, number> {
  if (!isCraftable(db, id) || qty <= 0) return new Map();
  return leaves(rawTree(db, id, qty));
}

export function addInto(a: Map<string, number>, b: Map<string, number>) {
  for (const [k, v] of b) a.set(k, (a.get(k) ?? 0) + v);
  return a;
}
