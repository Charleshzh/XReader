# XReader — Desktop Novel Reader

Tauri v2 + React 19 + TypeScript desktop app for reading local books (EPUB/TXT/PDF) and web-sourced novels via Legado-compatible book source rule engine.

**Status**: Phase 7 complete. All MVP phases delivered.

## Tech Stack

| Layer       | Tech                      | Version        |
| ----------- | ------------------------- | -------------- |
| Desktop     | Tauri                     | v2.11.2        |
| UI          | React + TypeScript        | 19.2.6 / 5.8.3 |
| Build       | Vite                      | 7.3.3          |
| CSS         | Tailwind CSS              | 3.4.19         |
| Components  | shadcn/ui                 | Button         |
| State       | Zustand                   | 5.0.13         |
| Router      | react-router-dom          | 7.15.1         |
| DB          | SQLite (rusqlite bundled) | 0.32.1         |
| Migrations  | refinery                  | 0.8.16         |
| EPUB parse  | epub crate                | 2.1.5          |
| PDF render  | pdfjs-dist (frontend)     | 5.7.284        |
| Encoding    | encoding_rs               | 0.8.35         |
| HTML escape | html-escape               | 0.2.13         |
| Error       | anyhow                    | 1.0            |
| Regex       | regex                     | 1.12           |
| Scraper     | scraper                   | 0.27           |
| XPath       | sxd-xpath                 | 0.4            |
| JSONPath    | jsonpath-rust             | 1.0            |
| JS Engine   | rquickjs (QuickJS)        | 0.11           |
| HTTP        | reqwest + cookie_store    | 0.13 / 0.22    |
| Charts      | recharts (frontend)       | 3.8            |
| Sync        | async-trait + chrono      | 0.1 / 0.4      |
| Logging     | env_logger + log          | 0.11 / 0.4     |
| Updater     | tauri-plugin-updater      | 2.10           |
| Package     | pnpm                      | 11.2.2         |

## Quick Commands

```bash
pnpm dev              # Vite dev server (port 1420)
pnpm build            # tsc + vite build
pnpm lint             # ESLint
pnpm format           # Prettier
pnpm tauri dev        # Full Tauri app with hot reload
pnpm tauri build      # Production build (exe + msi + nsis)

# Rust (in src-tauri/)
cargo check           # Type check
cargo test            # 39 pass, 8 ignored (edge cases)
cargo clippy -- -D warnings
cargo fmt --check
```

## Project Structure

```
xreader/
├── src/                          # React frontend
│   ├── main.tsx                  # Entry
│   ├── App.tsx                   # Router: / /reader/:id /stats /sources /search /settings
│   ├── globals.css               # Tailwind + shadcn CSS vars
│   ├── lib/utils.ts              # cn() helper
│   ├── types/                    # book.ts, reader.ts
│   ├── stores/                   # bookStore, readerStore, sourceStore
│   ├── components/
│   │   ├── ui/button.tsx          # shadcn Button
│   │   ├── bookshelf/            # BookCard, ImportDialog
│   │   └── reader/               # ReaderShell, HtmlContentView, PdfContentView,
│   │                               ChapterTOC, ReaderSettings, BookmarkPanel, AnnotationPanel
│   └── pages/                    # BookshelfPage, ReaderPage, StatsPage,
│                                   SearchPage, SourceManagePage, SettingsPage
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── main.rs / lib.rs      # Entry + AppState + 24 command registration
│   │   ├── commands.rs           # All IPC commands
│   │   ├── book/                 # BookFormat trait + EPUB/TXT/PDF parsers
│   │   ├── db/                   # SQLite init, models, queries, V1 migration
│   │   ├── source/               # Legado rule engine (Phase 5)
│   │   │   ├── tokenizer.rs      # @/||/## splitter
│   │   │   ├── compiler.rs       # Rule AST + compile_source()
│   │   │   ├── types.rs          # RuleSegment, CompiledSource, etc.
│   │   │   ├── http.rs           # reqwest client + encoding detection
│   │   │   ├── evaluator/        # 6 evaluators (css/xpath/json/regex/js/template)
│   │   │   └── pipeline/         # 4 pipelines (search/book_info/chapter_list/content)
│   │   └── sync/                 # Phase 6: WebDAV sync (types/webdav/mod)
│   ├── Cargo.toml
│   └── tauri.conf.json
├── docs/                         # phase-1 through phase-6 completion reports
├── .github/workflows/ci.yml      # CI: cargo check/test/clippy/fmt + tsc/eslint/prettier
└── package.json / tailwind.config.js / eslint.config.js / ...
```

## IPC Commands (24 total)

| #   | Command                  | Phase | Category        |
| --- | ------------------------ | ----- | --------------- |
| 1   | `greet`                  | 1     | Test            |
| 2   | `get_app_version`        | 1     | Meta            |
| 3   | `import_book`            | 2     | Books           |
| 4   | `list_books`             | 2     | Books           |
| 5   | `delete_book`            | 2     | Books           |
| 6   | `get_chapter_content`    | 2     | Reader          |
| 7   | `get_chapters`           | 3     | Reader          |
| 8   | `save_progress`          | 3     | Reader          |
| 9   | `add_bookmark`           | 4     | Annotations     |
| 10  | `list_bookmarks`         | 4     | Annotations     |
| 11  | `delete_bookmark`        | 4     | Annotations     |
| 12  | `add_annotation`         | 4     | Annotations     |
| 13  | `update_annotation_note` | 4     | Annotations     |
| 14  | `list_annotations`       | 4     | Annotations     |
| 15  | `delete_annotation`      | 4     | Annotations     |
| 16  | `log_reading_session`    | 4     | Stats           |
| 17  | `get_reading_stats`      | 4     | Stats           |
| 18  | `import_book_source`     | 5     | Sources         |
| 19  | `list_book_sources`      | 5     | Sources         |
| 20  | `delete_book_source`     | 5     | Sources         |
| 21  | `search_books`           | 5     | Sources (async) |
| 22  | `sync_now`               | 6     | Sync (async)    |
| 23  | `configure_sync`         | 6     | Sync            |
| 24  | `get_sync_config`        | 6     | Sync            |

## Rule Engine (Phase 5)

Tokeninzer → Compiler → 6 Evaluators → 4 Pipelines.

```
Legado JSON → compile_source() → CompiledSource
                                   │
                          SourcePipeline
                    ┌──────────┼──────────┐
                 Search   BookInfo  ChapterList  ChapterContent
                    │         │         │           │
                    └─────────┴─────────┴───────────┘
                                   │
                           RuleEvaluator
              CssEval | XpathEval | JsonEval | RegexEval | JsEval | TmplEval
```

39 tests pass, 8 ignored (JSON/JS edge cases). Supports all Legado rule types except `webJs` and `loginUi` (deferred).

## Conventions

- **Rust**: `anyhow::Result` internal, `Result<T, String>` at Tauri boundary. `#![allow(dead_code, unused_imports)]` at lib.rs.
- **BookFormat trait**: New formats = implement trait + register. Zero existing code modification.
- **Frontend layers**: Page → Feature → UI Component. Zustand stores: one per domain.
- **Asset protocol**: `convertFileSrc(path)` for local files.
- **Git**: GitHub Flow, Conventional Commits, main protected.
- **Before commit**: `cargo fmt && cargo clippy -- -D warnings && npx prettier --write "src/**/*.{ts,tsx,css}" && npx eslint .`

## Current State & Next Steps

**Done (Phase 1–7 — MVP Complete)**:

- Bookshelf + import (EPUB/TXT/PDF)
- Reader core (HTML + pdf.js, chapter TOC, settings, themes)
- Bookmarks + annotations + reading stats with charts
- Legado rule engine: Tokenizer, 6 evaluators, 4 pipelines
- Source management: import/delete, online search
- Cloud sync: WebDAV backend, SyncBackend trait, settings page
- Polish: chapter prefetch, ErrorBoundary, env_logger, auto-updater plugin
- 24 IPC commands, CI passing

**Future**: Phase 8 (TTS/MOBI/dictionary/mobile) — optional post-MVP
