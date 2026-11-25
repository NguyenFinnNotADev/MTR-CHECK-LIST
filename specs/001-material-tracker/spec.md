# Feature Specification: MTR Check list — Litematica material tracker

**Feature Branch**: `001-material-tracker`

**Created**: 2026-11-24

**Status**: Draft

**Input**: User description: see `SPECKIT_PROMPT.md` §2 (`/speckit.specify` block).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Import a material list and see it organized (Priority: P1)

The player exports a material list from Litematica (Java 1.21.11, English or Vietnamese game
language), presses "📂 Chọn file Litematica…", picks the `.txt`, names the project (default:
schematic name) and picks a map. The app shows every material with its icon, grouped by family
(Spruce, Wool, Concrete, Deepslate…), split into "Farm được" / "Không farm được", each group
labelled with its farm name or a short how-to-obtain note.

**Why this priority**: This is the core value — turning a raw text table into an organized,
visual shopping list.

**Independent Test**: Import `docs/sample/material_list_2026-11-24_18.52.58.txt` into an empty app
and check grouping, icons, farm badges and counts.

**Acceptance Scenarios**:

1. **Given** an empty app, **When** the sample file is imported, **Then** a project
   "AdventureTimeTreeHouse (Converted Sponge)" exists with exactly one row per data line of the file,
   each with an icon, and none in "Chưa phân loại" unless truly unknown.
2. **Given** the imported project, **Then** Lime Wool is in group Wool with badge "Sheep Farm";
   Spruce Stairs/Trapdoor/Sign/Door/Slab/Fence/Planks/Stripped Spruce Wood share group Spruce with
   badge "Tree Farm (Spruce)"; Black/Lime/Red/Green Concrete share group Concrete; Deepslate items
   share group Deepslate under "Không farm được".
3. **Given** a file exported from a Vietnamese-language client, **When** imported, **Then** items
   resolve to the same ids as the English file.
4. **Given** a file with an unknown name, **When** imported, **Then** the row appears in
   "Chưa phân loại" with a fallback tile icon and the import still succeeds.

---

### User Story 2 - Track collection progress per item (Priority: P1)

Each item is a notebook entry with three states — Chưa có (orange), Đang thu thập (blue),
Đã đủ (green). Clicking an item row marks it Đang thu thập; the row expands, tints blue and shows
a "Đã gom" number field (+64, +1 Shulker box), a progress bar and, for craftable items, the raw
material chain with needed and still-missing amounts. Reaching the total moves it to Đã đủ and into
the "Đã sở hữu" zone at the bottom.

**Why this priority**: Tracking is the daily-use loop.

**Independent Test**: On the sample project, drive Stripped Spruce Wood through all states.

**Acceptance Scenarios**:

1. **Given** Stripped Spruce Wood is Chưa có, **When** the user clicks its row, **Then** it becomes
   Đang thu thập, expands, tints blue.
2. **Given** it is Đang thu thập, **When** the user enters 3 520, **Then** the row shows
   "10 656 Spruce Log" needed and "5 964" missing.
3. **When** the user enters 7 992, **Then** it auto-switches to Đã đủ and moves to the bottom zone.
4. **Given** item A is Đang thu thập but not finished, **When** the user clicks item B, **Then** B
   becomes Đang thu thập and A keeps its state and number.
5. **Given** any state change, **Then** the "Đã gom" number is never erased.

---

### User Story 3 - Multiple projects (sessions) that persist (Priority: P1)

The player works on several builds in parallel; each project keeps its own states and numbers.
Closing and reopening the app restores everything, including selected project, sort, language and
theme.

**Independent Test**: Create two projects, change states in each, restart, verify.

**Acceptance Scenarios**:

1. **Given** two projects, **When** progress is changed in A, **Then** B is unchanged.
2. **Given** any changes, **When** the app is closed and reopened, **Then** all state is restored.
3. **Given** the app folder copied to another path, **When** run, **Then** data comes along.

---

### User Story 4 - Maps and owned farms (Priority: P2)

Projects belong to a map/server. In the "Map & Farm" tab the player ticks which farms exist on each
map. Every project on that map shows "✔ đã có" on the matching group badges and those groups sort
first. The badge itself can be clicked to toggle quickly.

**Acceptance Scenarios**:

1. **Given** two projects on map "Polym", **When** "Tree Farm (Spruce)" is ticked for Polym,
   **Then** both show "✔ đã có"; a project on another map does not.
2. **Given** a map is deleted, **Then** the user must choose to move its projects to another map
   or delete them.

---

### User Story 5 - Sorting, search, filters, group raw totals (Priority: P2)

Default sort "Farm ra nhiều loại nhất": owned-farm groups first, then groups with the most distinct
items in the project, ties by total amount. Alternatives: "Số lượng", "Tên A–Z", and ⇅ reverse.
Search matches EN and VI names. Status filter chips. Clicking a group header expands a collapsed
group raw-total strip (total base materials needed, missing, in shulkers, % progress; one chip per
base material).

**Acceptance Scenarios**:

1. **Given** language Việt, **When** searching "len", **Then** wool items show.
2. **Given** the Spruce group, **When** its header is clicked, **Then** the raw-total strip opens
   with Spruce Log totals; clicking again collapses it.

---

### User Story 6 - Language, themes, backup (Priority: P3)

Settings: English / Tiếng Việt / Duo (EN main + VI small); themes A Cozy Cabin, B Campfire Night,
C Meadow Pastel matching the mockups; export/import full backup JSON; open data folder.

**Acceptance Scenarios**:

1. **Given** Tiếng Việt, **Then** Lime Wool shows its exact `vi_vn` name; the word "farm" is never
   rendered as "trang trại".

---

### User Story 7 - Classify unknown items (Priority: P3)

Unknown items appear in "Chưa phân loại". The user assigns an existing or new group, a farm or
"không farm được" + how-to, optional VI name and max stack. The mapping is saved and reused on
future imports.

---

### Edge Cases

- File without the "Material List for schematic" header → project name defaults to file name.
- Repeated header/separator lines at file end, CRLF/LF, extra spaces, thousands separators.
- Empty file or non-Litematica text → friendly error, no project created.
- Duplicate item lines in one file → amounts summed.
- Non-stackable (bucket, bed, cake) and 16-stack items (signs, banners, eggs) → quantity format and
  "+1 Shulker box" use the item's own stack size.
- Entering more than total → clamps display at 100% and switches to Đã đủ.
- Negative or non-numeric input → rejected, previous value kept.
- Disk write failure → visible warning; in-memory state kept; retry on next change.
- Missing icon file → fallback tile, never broken image.
- Window 1024×640 → no horizontal scroll.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Import via file picker only (`.txt`); each import creates a new project; original file
  copied into `data\imports\`.
- **FR-002**: Parse the Litematica table using only `Item` and `Total`; ignore `Missing` and
  `Available` completely.
- **FR-003**: Resolve names to Minecraft ids using both official EN and VI language files plus user
  overrides, case-insensitive; unresolved rows go to "Chưa phân loại".
- **FR-004**: Every item belongs to a group; every group is either farmable (one or more named farms)
  or not farmable (short how-to text).
- **FR-005**: Items have exactly three states: Chưa có (orange), Đang thu thập (blue), Đã đủ (green),
  shown as three adjacent buttons using those colors.
- **FR-006**: Clicking an item row that is Chưa có sets it to Đang thu thập. Other items keep their
  states; only manual action or reaching the total changes them.
- **FR-007**: An Đang thu thập row auto-expands, tints with the blue status color (light background,
  strong left border) and shows: number input "Đã gom", buttons +64 and "+1 Shulker box" (27 × stack
  size), progress bar, and for craftable items the raw-material chain with needed and missing amounts.
- **FR-008**: Raw materials per item are shown ONLY in the Đang thu thập state.
- **FR-009**: When collected ≥ total, the item switches to Đã đủ automatically. Changing state never
  clears the collected number.
- **FR-010**: Quantities display as shulkers + remainder, e.g. "5 shulker + 561", using the item's
  stack size; small amounts show stacks + remainder.
- **FR-011**: Layout: sidebar (logo, projects grouped by map with % progress, file button, tabs
  Nguyên liệu / Map & Farm / Cài đặt), header (name, map chip, x/y types + %), toolbar (search, sort
  modes, ⇅, status filter), zone "Chưa sở hữu" (Farm được → Không farm được → Chưa phân loại), zone
  "Đã sở hữu" at the bottom, dimmed, collapsible with a summary bar.
- **FR-012**: Group header shows name, farm badge(s) ("✔ đã có" when owned on the project's map),
  or "✖ Không farm" + how-to, type count and total amount. Multi-source groups list chained farms.
- **FR-013**: Group raw-total strip is collapsed by default and toggled by clicking the group header.
- **FR-014**: Sorting as in User Story 5; within a group, Đang thu thập items first.
- **FR-015**: Maps: create, rename, delete (with move-or-delete projects choice); per-map farm
  checklist; badge click toggles ownership for the current map.
- **FR-016**: Projects: rename, change map, duplicate, delete (confirm), reset to Chưa có; % progress
  = Đã đủ types / all types.
- **FR-017**: Settings persisted: language (EN / VI / Duo), theme (A/B/C), sort mode + direction,
  selected project, collapsed zones.
- **FR-018**: Backup export/import of maps + projects + overrides as one JSON; open data folder.
- **FR-019**: Classification UI for unknown items, saved to a user override file and applied on
  future imports.
- **FR-020**: All data autosaves; restarting restores everything.
- **FR-021**: Every item shows a flat pixel-art icon scaled without blur in an inventory-slot frame
  (rounded in theme C); fallback colored tile + initial.

### Key Entities

- **Map**: name, set of owned farm ids.
- **Project**: name, schematic name, map, created/updated dates, list of project items.
- **Project item**: item id (or raw name if unknown), total, state, collected amount.
- **Item (database)**: id, EN name, VI name, stack size, group, icon.
- **Group**: id, EN/VI name, farm ids, base materials, how-to (EN/VI).
- **Farm**: id, EN/VI name (keeps "farm"), produced base items.
- **Recipe**: output item, count, inputs — used for raw-material math.
- **Settings**: language, theme, sort, selection, UI collapse state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Importing the sample file (≈200 types) takes under 2 seconds and 100% of rows appear.
- **SC-002**: 100% of sample items have an icon and a group; 0 sample items unclassified.
- **SC-003**: Raw-material numbers match hand-calculated values for the acceptance examples
  (7 992 Stripped Spruce Wood → 10 656 Spruce Log).
- **SC-004**: Marking an item and typing a number takes ≤ 2 clicks + typing.
- **SC-005**: After restart, 100% of states, numbers and settings are restored.
- **SC-006**: App memory stays under 80 MB with a 300-type project; works fully offline.
- **SC-007**: No horizontal scrolling at 1024×640.

## Assumptions

- Interpretation of the user's note on clicking: clicking a Chưa có row starts collecting it; an
  unfinished collecting item is never changed automatically by clicking another item. Rows already
  Đang thu thập or Đã đủ only change through the status buttons or by reaching the total.
- "+1 Shulker box" = 27 stacks of the item's stack size (1 728 for 64-stack items).
- Raw-material math uses the most efficient vanilla recipe (stonecutter preferred for stone).
- Farm data is curated community knowledge for Java 1.21.11; exact designs are not required.
- Re-importing the same schematic creates a new project (no merge).
- Desktop Windows 10/11 only; no mobile; no network.
