# Implementation Plan: MTR Check list — Litematica material tracker

**Branch**: `001-material-tracker` | **Date**: 2026-11-24 | **Spec**: [spec.md](spec.md)

## Summary

Portable offline Windows desktop app (Tauri 2 + React + TS) that imports Litematica material lists,
resolves items against a generated Minecraft 1.21.11 database (names EN/VI, stack sizes, icons,
recipes) plus curated groups/farms, and lets the user track per-item collection across projects and
maps. Data scripts (Node) build the database from local game assets.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Rust stable (Tauri 2 shell), Node 26 for scripts
**Primary Dependencies**: tauri 2, tauri-plugin-dialog, react 18, zustand, vite; scripts: pngjs,
yauzl (jar reading)
**Storage**: JSON files next to the exe (`data\`, `database\`), atomic writes + 10 rotating backups
**Testing**: Vitest for `src/core`
**Target Platform**: Windows 10/11 x64 with WebView2 (preinstalled)
**Project Type**: desktop app
**Performance Goals**: import ≤ 2 s for 300 types; < 80 MB RAM
**Constraints**: offline, portable, no AppData/registry, min window 1024×640
**Scale/Scope**: ~1 500 items in DB, projects of up to ~400 types

## Constitution Check

| Principle | How the plan complies |
|---|---|
| I Offline | fonts/icons/data bundled; no fetch; CSP blocks remote |
| II Portable | exe-relative paths; WebView2 `data_directory` → `data\.webview` |
| III Lightweight | Tauri + system WebView2; no UI kit |
| IV No data loss | debounce 500 ms autosave, tmp+rename, backups |
| V Data outside code | `database\*.json` loaded at runtime; scripts regenerate |
| VI Exact names | names from en_us/vi_vn; farm names curated, "farm" kept |
| VII Cozy UI | 3 themes from mockups; icon fallback tile; responsive grid |
| VIII Tested core | `src/core` pure + Vitest |

## Project Structure

```text
D:\App\MTR Check list by NguyenFinn\
├─ MTR Check list.exe
├─ data\ (app.json, maps.json, projects\, imports\, backups\, .webview\)
├─ database\ (items.json, groups.json, farms.json, recipes.json, lang_index.json, user_overrides.json)
├─ icons\<id>.png
└─ _source\
   ├─ mc-assets\        (trimmed vanilla assets + vi_vn.json + recipes extracted from jar)
   ├─ scripts\          (prepare-assets, build-db, build-icons, validate-db)
   ├─ curated\          (groups.src.json, farms.src.json — hand-written)
   ├─ src\core\         (parse, resolve, raw, partition, sort, format) + tests
   ├─ src\ui\           (React components, themes.css)
   ├─ src-tauri\        (Rust shell: fs commands, portable paths)
   └─ specs\, docs\, .specify\
```

## Data pipeline

1. `prepare-assets`: copy items/, models/, blockstates/, textures/block, textures/item, lang/en_us
   from `26.3.x-Template` into `mc-assets`; add vi_vn.json (Modrinth asset index for 1.21.11);
   extract `data/minecraft/recipe/*.json` + item stack sizes source from the 1.21.11 jar; verify;
   delete template.
2. `build-db`: items = every `items/*.json` id; EN/VI names from `block.minecraft.*`/`item.minecraft.*`;
   stack size from built-in rules table (non-stackable / 16 lists); recipe graph reduced to one
   preferred recipe per output (stonecutter > crafting > smelting), stopping at group base items;
   groups/farms from curated sources; lang_index maps lower-cased EN+VI names → id.
3. `build-icons`: items/<id>.json → model → texture (layer0 for item models; for block models
   side/all/texture/end/top, following parents), frame 0 of animated strips, 16→64 nearest-neighbor.
4. `validate-db`: every sample item resolves, has group + icon; report gaps.

## Core logic (src/core)

parseLitematica, resolveItemId, rawMaterials (ceil per craft step), groupTotals, partition,
sortGroups, formatQty (shulker = 27 × stack), applyCollected (auto Đã đủ), clickRow.

## UI

Sidebar, Header, Toolbar, Zone, GroupCard (+ collapsible raw strip), ItemRow (3 status buttons
orange/blue/green; expanded collecting panel), OwnedBar, MapFarmTab, SettingsTab, Unclassified
panel, ImportDialog, ConfirmDialog. CSS variables per theme (cabin/night/meadow) from mockup.

## Complexity Tracking

None.
