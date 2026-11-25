import type { ProjectItem, Status } from './types';

/** Click on a row: a "none" item starts collecting; others are unchanged. */
export function clickRow(it: ProjectItem): ProjectItem {
  return it.status === 'none' ? { ...it, status: 'collecting' } : it;
}

export function setStatus(it: ProjectItem, status: Status): ProjectItem {
  return { ...it, status };
}

/** Update collected amount; reaching the total switches to "done". Never erases on state change. */
export function setCollected(it: ProjectItem, value: number): ProjectItem {
  if (!Number.isFinite(value) || value < 0) return it;
  const collected = Math.floor(value);
  const status: Status = collected >= it.total ? 'done' : it.status === 'done' ? 'collecting' : it.status;
  return { ...it, collected, status };
}

/** The row the user clicked last, with a snapshot taken when it was clicked. */
export interface ActiveRow { key: string; prevStatus: Status; collectedAtClick: number }

/**
 * Settle the previously active row when the user moves on:
 * - collected ≥ total → done
 * - nothing changed since the click → back to the status it had before the click
 * - otherwise (some progress) → stays collecting
 */
export function settleActive(items: ProjectItem[], active: ActiveRow | null): ProjectItem[] {
  if (!active) return items;
  return items.map(it => {
    if (it.key !== active.key || it.status !== 'collecting') return it;
    if (it.collected >= it.total) return { ...it, status: 'done' };
    if (it.collected === active.collectedAtClick) return { ...it, status: active.prevStatus };
    return it;
  });
}

/** Click a row: settle the previous active row, then make this one collecting + active. */
export function activateRow(items: ProjectItem[], active: ActiveRow | null, key: string): { items: ProjectItem[]; active: ActiveRow | null } {
  if (active?.key === key) return { items, active };
  const settled = settleActive(items, active);
  const it = settled.find(i => i.key === key);
  if (!it || it.status === 'done') return { items: settled, active: null };
  return {
    items: settled.map(i => (i.key === key ? clickRow(i) : i)),
    active: { key, prevStatus: it.status, collectedAtClick: it.collected },
  };
}

export const progress =(it: ProjectItem) => Math.min(1, it.total ? it.collected / it.total : 0);
export const missingQty = (it: ProjectItem) => Math.max(0, it.total - it.collected);
