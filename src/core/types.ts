export type Lang = 'en' | 'vi' | 'duo';
export type Theme = 'white' | 'black' | 'gray' | 'beige' | 'blue' | 'medieval' | 'pink';
export type SortMode = 'farm' | 'qty' | 'name';
export type Status = 'none' | 'collecting' | 'done';

export interface DbItem {
  id: string;
  en: string;
  vi: string | null;
  stack: number;
  group: string;
  farmable?: boolean; // derived groups only
  farms?: string[]; // derived groups only
}
export interface DbGroup {
  id: string;
  en: string;
  vi: string;
  farms: string[];
  derived: boolean;
  base: string[];
  howTo: { en: string; vi: string } | null;
}
export interface DbFarm { id: string; en: string; vi: string; produces: string[] }
export interface Recipe { n: number; in: Record<string, number>; how: string }

export interface UserOverrideItem {
  name: string; // raw name as seen in the file
  group: string;
  vi?: string;
  stack?: number;
}
export interface UserOverrides {
  items: Record<string, UserOverrideItem>; // key: custom id "custom:<slug>"
  groups: DbGroup[];
}

export interface Db {
  items: Map<string, DbItem>;
  groups: Map<string, DbGroup>;
  farms: Map<string, DbFarm>;
  recipes: Record<string, Recipe>;
  langIndex: Record<string, string>;
  baseSet: Set<string>;
  overrides: UserOverrides;
}

export interface ProjectItem {
  key: string; // item id, or "?<raw name>" when unresolved
  name: string; // raw name from file
  total: number;
  status: Status;
  collected: number;
}
export interface Project {
  id: string;
  name: string;
  schematic: string;
  mapId: string;
  createdAt: string;
  updatedAt: string;
  importFile?: string;
  items: ProjectItem[];
  /** last clicked row + snapshot, used to settle it when the user moves on */
  active?: { key: string; prevStatus: Status; collectedAtClick: number } | null;
  /** one snapshot per day with changes */
  history?: HistoryPoint[];
}
export interface HistoryPoint { date: string; doneTypes: number; totalTypes: number; missingQty: number }

export interface GameMap {
  id: string;
  name: string;
  ownedFarms: string[];
  itemNotes?: Record<string, string>; // item id → note (shared by every build on this map)
  farmNotes?: Record<string, string>; // farm id → where the farm is
}

export interface WindowBounds { x: number; y: number; w: number; h: number }

export interface Settings {
  lang: Lang;
  theme: Theme;
  sort: SortMode;
  reverse: boolean;
  currentProject: string | null;
  ownedCollapsed: boolean;
  statusFilter: Status | 'all';
  hideMainOnMini: boolean;
  miniOnTop: boolean;
  miniOpacity: number; // 0.35 – 1
  miniBounds: WindowBounds | null;
  /** off = none, lite = subtle (default), full = rich motion; applied on (re)launch */
  anim: AnimLevel;
  /** launcher instance folder used as the start folder when picking material lists */
  materialsDir: string | null;
}
export type AnimLevel = 'off' | 'lite' | 'full';
