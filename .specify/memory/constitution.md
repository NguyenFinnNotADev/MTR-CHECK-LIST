<!--
Sync Impact Report
- Version change: (template) → 1.0.0
- Principles: 8 new (I–VIII), replacing template placeholders
- Added sections: Technology & Data Constraints, Development Workflow & Quality Gates
- Removed sections: none
- Follow-up TODOs: none
-->

# MTR Check list by NguyenFinn Constitution

## Core Principles

### I. Offline Only
The app MUST run with no internet connection. Fonts, icons, translations and game data are
bundled locally. The app MUST NOT make network calls or send telemetry.

### II. Portable Folder
The whole app is one folder. Copying it to another Windows 10/11 machine or another path MUST
be enough to run it with all data intact. No installer, no registry writes, no AppData writes:
all data (including the WebView2 profile) lives next to the exe.

### III. Lightweight
Low memory use is a primary goal: target < 80 MB RAM with a 300-item project. Use the system
WebView2; never bundle Chromium. No heavy UI libraries.

### IV. No Data Loss
Every change autosaves (debounce ≤ 1 s) using atomic writes (temp file + rename) with rotating
backups (last 10 per file). An unknown item or malformed import MUST NOT crash the app; it is
surfaced to the user instead.

### V. Game Data Outside Code
Items, groups, farms, recipes and translations live in JSON under `database\` and can be edited
without rebuilding. Upgrading the Minecraft version means replacing source assets and re-running
the data scripts, never editing UI code.

### VI. Exact Names, Untranslated "farm"
Item names MUST match Minecraft's official `en_us.json` / `vi_vn.json` exactly. Farm names may be
approximate, but the word "farm" is NEVER translated (never "trang trại").

### VII. Cozy, Clear, Iconic UI
The UI is cozy, simple and readable, following the approved mockups (3 themes). Every item shows an
icon (fallback: colored tile + initial, never a broken image). The layout adapts to window size
down to 1024×640 with no horizontal scroll. Desktop only.

### VIII. Tested Pure Core
TypeScript strict mode. Pure logic (parsing, id resolution, raw-material math, partitioning,
sorting, formatting) lives in `src/core` separate from UI and is covered by unit tests.

## Technology & Data Constraints

- Tauri 2 + React + TypeScript + Vite; Zustand for state; plain CSS variables for themes.
- Target game version: Minecraft Java 1.21.11; data pipeline must be re-runnable for newer versions.
- Rust side exposes only minimal file commands; every path is validated to stay inside the app folder.

## Development Workflow & Quality Gates

- Order of work: data scripts → core + tests → UI → packaging.
- A phase is done only when its tests pass and UI screenshots are compared against the mockups.
- Source assets (`26.3.x-Template`) are deleted only after the copied `mc-assets` is verified complete.

## Governance

This constitution overrides other practices for this project. Amendments require updating this
file with a version bump (MAJOR: principle removed/redefined; MINOR: principle/section added;
PATCH: wording) and noting the change in the Sync Impact Report. Every plan and task list MUST
include a constitution check against principles I–VIII.

**Version**: 1.0.0 | **Ratified**: 2026-11-24 | **Last Amended**: 2026-11-24
