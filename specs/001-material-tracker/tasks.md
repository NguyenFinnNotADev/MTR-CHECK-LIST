# Tasks: MTR Check list

## Phase 1 — Setup
- [ ] T001 Install toolchain (VS C++ Build Tools, Rust) and scaffold Vite + React + TS + Tauri 2 in `_source`
- [ ] T002 Bundle fonts (Nunito, Pixelify Sans woff2) locally

## Phase 2 — Data pipeline
- [ ] T003 `scripts/prepare-assets.mjs`: copy needed assets, vi_vn.json, extract recipes from jar, verify, delete template
- [ ] T004 `curated/groups.src.json` + `curated/farms.src.json` (all sample items covered, broad vanilla coverage)
- [ ] T005 `scripts/build-db.mjs`: items/names/stack sizes/recipes/lang_index → `database\`
- [ ] T006 `scripts/build-icons.mjs` → `icons\`
- [ ] T007 `scripts/validate-db.mjs` against sample file

## Phase 3 — Core (US1–US5)
- [ ] T008 parseLitematica + tests
- [ ] T009 resolveItemId (EN+VI+overrides) + tests
- [ ] T010 rawMaterials / groupTotals + tests (7 992 → 10 656)
- [ ] T011 partition / sortGroups / formatQty / state transitions + tests

## Phase 4 — Persistence
- [ ] T012 Rust commands (read/write atomic + backups, pick file, copy, open folder, app dir), portable WebView2 dir
- [ ] T013 Zustand store + autosave + load on start

## Phase 5 — UI
- [ ] T014 Themes CSS + layout shell (sidebar/header/toolbar)
- [ ] T015 GroupCard / ItemRow / collecting panel / raw strip / OwnedBar
- [ ] T016 Import dialog, project actions, map & farm tab
- [ ] T017 Settings (language, theme, backup), unclassified panel
- [ ] T018 Screenshot check vs mockups at 1440×900 and 1024×640

## Phase 6 — Release
- [ ] T019 Build portable exe, copy to app root, README (VI)
- [ ] T020 Run acceptance criteria 1–8
