# XReader — Desktop Novel Reader

Tauri v2 desktop app for reading local books (EPUB/TXT/PDF) and web-sourced novels via Legado-compatible book source rule engine.

**Status**: Phase 7 complete — MVP delivered.

## Quick Start

```bash
pnpm install
pnpm tauri dev
```

## Features

### Bookshelf & Import

- EPUB metadata/cover/chapters extraction, TXT encoding detection (GBK/UTF-8/Big5) + regex chapter split, PDF import
- Grid/list views, search filter, cover images, format badges, multi-file import dialog

### Reader Core

- EPUB/TXT HTML rendering (scroll or paginated), PDF canvas rendering (pdf.js, zoom 0.5-3x)
- Chapter TOC sidebar with jump navigation
- Settings panel: font size (14-28px), line height (1.4-2.5x), theme (light/dark/sepia), scroll/page mode
- Reading progress auto-save and restore
- Keyboard navigation (Arrow keys)

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
- 4 pipelines: Search, BookInfo, ChapterList, ChapterContent
- Source management: import/export Legado JSON, online search from book sources

### Cloud Sync

- WebDAV backend with Basic Auth
- SyncBackend trait for pluggable sync providers
- Settings page for endpoint/credential configuration

## Tech Stack

| Layer     | Tech                                                   |
| --------- | ------------------------------------------------------ |
| Desktop   | Tauri v2 (Rust backend)                                |
| Frontend  | React 19 + TypeScript 5.8 + Vite 7                     |
| CSS       | Tailwind CSS 3 + shadcn/ui                             |
| State     | Zustand 5                                              |
| Router    | react-router-dom 7                                     |
| DB        | SQLite (rusqlite bundled) + refinery migrations        |
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
```

In `src-tauri/`:

```bash
cargo check           # Type check
cargo test            # 39 pass, 8 ignored (edge cases)
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
