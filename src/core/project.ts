import { resolveItemId } from './db';
import type { ParsedList } from './parse';
import type { Db, Project, ProjectItem } from './types';

export const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function createProject(db: Db, parsed: ParsedList, name: string, mapId: string, importFile?: string): Project {
  const now = new Date().toISOString();
  const items: ProjectItem[] = parsed.rows.map(r => ({
    key: resolveItemId(db, r.name) ?? `?${r.name}`,
    name: r.name,
    total: r.total,
    status: 'none',
    collected: 0,
  }));
  return { id: newId('p'), name: name.trim() || parsed.schematic, schematic: parsed.schematic, mapId, createdAt: now, updatedAt: now, importFile, items };
}

/** Re-resolve unknown rows (after the user classified something). */
export function reresolve(db: Db, p: Project): Project {
  let changed = false;
  const items = p.items.map(it => {
    if (db.items.has(it.key)) return it;
    const id = resolveItemId(db, it.name);
    if (!id) return it;
    changed = true;
    return { ...it, key: id };
  });
  return changed ? { ...p, items } : p;
}

export function duplicateProject(p: Project, name: string): Project {
  const now = new Date().toISOString();
  return { ...structuredClone(p), id: newId('p'), name, createdAt: now, updatedAt: now };
}

export function resetProject(p: Project): Project {
  return { ...p, active: null, items: p.items.map(i => ({ ...i, status: 'none', collected: 0 })) };
}
