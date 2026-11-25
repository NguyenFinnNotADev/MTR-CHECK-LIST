export interface ParsedRow { name: string; total: number }
export interface ParsedList { schematic: string; rows: ParsedRow[] }

export class ParseError extends Error {}

/** Parse a Litematica material_list_*.txt. Only Item and Total columns are used. */
export function parseLitematica(text: string, fileName = 'material_list'): ParsedList {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  let schematic = '';
  const m = text.match(/schematic\s+'(.+?)'\s*\(/i);
  if (m) schematic = m[1];
  const totals = new Map<string, number>();
  for (const line of lines) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').map(s => s.trim());
    // ['', Item, Total, Missing, Available, '']
    if (cells.length < 4) continue;
    const name = cells[1];
    const totalRaw = cells[2].replace(/[\s., ]/g, '');
    if (!name || !/^\d+$/.test(totalRaw)) continue; // header / title rows
    const total = parseInt(totalRaw, 10);
    if (total <= 0) continue;
    totals.set(name, (totals.get(name) ?? 0) + total);
  }
  if (totals.size === 0) throw new ParseError('Không tìm thấy bảng nguyên liệu Litematica trong file.');
  if (!schematic) schematic = fileName.replace(/\.[^.]+$/, '');
  return { schematic, rows: [...totals].map(([name, total]) => ({ name, total })) };
}
