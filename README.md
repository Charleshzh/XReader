# XReader — Desktop Novel Reader

Tauri v2 desktop app for reading local books (EPUB/TXT/PDF) and web-sourced novels via Legado-compatible book source rule engine.

**Status**: Beta-ready — release hardening verified by Rust tests, Vitest, Playwright route smoke, and packaged Windows startup smoke.

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

- EPUB/TXT HTML rendering with annotation + search highlighting, Chinese conversion, and scroll/paginated reading; PDF canvas rendering (pdf.js, zoom 0.5-3x)
- Chapter TOC sidebar, exact progress restore, page-aware progress saving, and keyboard navigation
- Versioned reader settings with style presets, configurable typography/theme/chrome, configurable 3x3 tap zones, and optional auto paging
- Built-in content search, Web Speech TTS speed control for HTML chapters, and bookmarks/annotations side panels
- Reader bundle import/export for backing up or sharing reader settings

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

- Versioned reader settings and sync configuration persisted to SQLite
- Reader bundle import/export, route-level error boundary, and back navigation on all sub-pages (stats, search, sources, settings, discover)

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
pnpm test             # Vitest frontend unit tests
pnpm tauri dev        # Full Tauri app with hot reload
pnpm tauri build      # Production build (exe + msi + nsis)
pnpm test:e2e         # Playwright route smoke tests
```

If your shell injects `CI=1`, use `CI=false pnpm tauri build`.

In `src-tauri/`:

```bash
cargo check           # Type check
cargo test            # Rust backend test suite
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
