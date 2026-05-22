# XReader — Desktop Novel Reader

Tauri v2 desktop app for reading local books (EPUB/TXT/PDF) and web-sourced novels via Legado-compatible book source rule engine.

**Status**: Beta-ready — 65/72 plan items (90%), 52 Rust + 9 E2E tests, CI cross-platform builds.

## Quick Start

```bash
pnpm install
pnpm tauri dev
```

## Features

### Bookshelf & Import

- EPUB metadata/cover/chapters extraction, TXT encoding detection (GBK/UTF-8/Big5) + regex chapter split, PDF import
- Grid/list views with virtualized rendering (@tanstack/react-virtual), search filter, cover images, format badges, multi-file import dialog

### Reader Core

- EPUB/TXT HTML rendering (scroll or paginated), PDF canvas rendering (pdf.js, zoom 0.5-3x)
- Chapter TOC sidebar with jump navigation
- Settings panel: font size slider (10-32px), line height slider (1.0-3.0x), font family (system/serif/sans-serif/KaiTi/monospace), theme (light/dark/sepia), scroll/page mode
- Reading progress auto-save and restore; all reader settings persisted
- Keyboard navigation (Arrow keys) + click-zone page turns (left/right 30%)
- Annotation text highlighting in five colors (yellow/green/blue/pink/orange)

### Bookmarks & Annotations

- Bookmarks: add/list/delete, jump to chapter
- Highlights: text selection, 5 color-coded highlight styles
- Notes: per-highlight note editor, annotation list panel

### Reading Stats

- Session timer (10s granularity), daily/weekly/monthly aggregation
- Recharts bar chart dashboard, daily reading goals

### Book Source Engine (Legado-compatible)

- Tokenizer + Compiler: parse Legado rule DSL (`@`/`||`/`##`/`{{key}}`/`{$.field}`)
- 6 evaluators: CSS (scraper), XPath (sxd-xpath), JSONPath, Regex, JS (rquickjs/QuickJS), Template
- 5 pipelines: Search, Explore (discover page), BookInfo, ChapterList, ChapterContent
- Source management: import/export Legado JSON, online search + discover from book sources

### Cloud Sync

- WebDAV backend with Basic Auth, bidirectional timestamp-based incremental sync
- SyncBackend trait for pluggable sync providers (WebDAV, S3, REST)
- 3-phase sync: snapshot → network → merge with automatic conflict resolution

### Data Export

- Bookmark export to Markdown: chapter title + label with save dialog
- Annotation export to Markdown: chapter title + quoted text + note

### Settings & UX

- Reader settings persisted to SQLite (font size, line height, font family, theme, mode)
- Back navigation on all sub-pages (stats, search, sources, settings, discover)

## Tech Stack

| Layer     | Tech                                                   |
| --------- | ------------------------------------------------------ |
| Desktop   | Tauri v2 (Rust backend)                                |
| Frontend  | React 19 + TypeScript 5.8 + Vite 7                     |
| CSS       | Tailwind CSS 3 + shadcn/ui                             |
| State     | Zustand 5                                              |
| Router    | react-router-dom 7                                     |
| Virtual   | @tanstack/react-virtual 3                              |
| Dialog    | @tauri-apps/plugin-dialog 2                            |
| EPUB      | epub crate                                             |
| PDF       | pdfjs-dist 5.7 (frontend), lopdf (metadata)            |
| Encoding  | encoding_rs                                            |
| Scraper   | scraper (CSS), sxd-xpath (XPath), jsonpath-rust (JSON) |
| JS Engine | rquickjs (QuickJS)                                     |
| HTTP      | reqwest + cookie_store                                 |
| Sync      | async-trait + chrono + WebDAV                          |
| Charts    | recharts                                               |
| Logging   | env_logger                                             |
| Updater   | tauri-plugin-updater                                   |

## Commands

```bash
pnpm dev              # Vite dev server (port 1420)
pnpm build            # tsc + vite build
pnpm lint             # ESLint
pnpm format           # Prettier
pnpm tauri dev        # Full Tauri app with hot reload
pnpm tauri build      # Production build (exe + msi + nsis)
pnpm test:e2e         # Playwright E2E smoke tests (9 cases)
```

In `src-tauri/`:

```bash
cargo check           # Type check
cargo test            # 52 pass, 7 ignored (edge cases)
cargo clippy -- -D warnings
cargo fmt --check
```

## Before Commit

```bash
cargo fmt && cargo clippy -- -D warnings && npx prettier --write "src/**/*.{ts,tsx,css}" && npx eslint .
```

## Project Docs

| File                         | Content                                                                 |
| ---------------------------- | ----------------------------------------------------------------------- |
| `CLAUDE.md`                  | Full project reference (architecture, conventions, stack, IPC commands) |
| `docs/USAGE.md`              | User manual — installation, import, reading, book sources, sync         |
| `docs/CONTEXT.md`            | Domain model & terminology                                              |
| `docs/phase-1-completion.md` | Phase 1: Scaffold, DB, CI                                               |
| `docs/phase-2-completion.md` | Phase 2: Bookshelf + import                                             |
| `docs/phase-3-completion.md` | Phase 3: Reader core                                                    |
| `docs/phase-4-completion.md` | Phase 4: Bookmarks, notes, stats                                        |
| `docs/phase-5-completion.md` | Phase 5: Legado rule engine                                             |
| `docs/phase-6-completion.md` | Phase 6: Cloud sync                                                     |
| `docs/phase-7-completion.md` | Phase 7: Polish & release                                               |

## License

MIT
