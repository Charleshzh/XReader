# XReader — Desktop Novel Reader

Tauri v2 + React 19 + TypeScript desktop app for reading local books and web-sourced novels. Legado-compatible book source rule engine for scraping novel websites.

**Status**: Phase 2 complete (bookshelf + import). Entering Phase 3 (reader core).

## Tech Stack

| Layer | Tech | Version |
|-------|------|---------|
| Desktop | Tauri | v2.11.2 |
| UI | React + TypeScript | 19.2.6 / 5.8.3 |
| Build | Vite | 7.3.3 |
| CSS | Tailwind CSS | 3.4.19 |
| Components | shadcn/ui | (Button only so far) |
| State | Zustand | 5.0.13 |
| Router | react-router-dom | 7.15.1 |
| DB | SQLite (rusqlite bundled) | 0.32.1 |
| Migrations | refinery | 0.8.16 |
| EPUB | epub crate | 2.1.5 |
| PDF render | pdfjs-dist (frontend) | 5.7.284 |
| PDF meta | lopdf | 0.40.0 |
| Encoding | encoding_rs | 0.8.35 |
| Package | pnpm | 11.2.2 |

## Project Structure

```
xreader/
├── src/                          # React frontend
│   ├── main.tsx                  # Entry: ReactDOM.createRoot
│   ├── App.tsx                   # BrowserRouter → Routes
│   ├── globals.css               # Tailwind directives + shadcn CSS vars (light/dark)
│   ├── lib/utils.ts              # cn() helper (clsx + tailwind-merge)
│   ├── types/                    # TS type definitions
│   │   ├── book.ts               # BookItem, ImportResult, ViewMode
│   │   └── reader.ts             # Reader types (WIP)
│   ├── stores/                   # Zustand state
│   │   ├── bookStore.ts          # Books CRUD, viewMode, loadBooks/importBook/deleteBook
│   │   └── readerStore.ts        # Reader state (WIP)
│   ├── components/
│   │   ├── ui/                   # shadcn/ui primitives
│   │   │   └── button.tsx        # Button (cva variants)
│   │   ├── bookshelf/            # Bookshelf components
│   │   │   ├── BookCard.tsx      # Grid card with cover, title, author, format badge, delete
│   │   │   └── ImportDialog.tsx  # Modal for file import
│   │   └── reader/               # Reader components (WIP)
│   └── pages/
│       ├── BookshelfPage.tsx     # Main bookshelf: grid/list, search, import, empty state
│       └── ReaderPage.tsx        # Reader page (WIP)
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── main.rs               # Windows subsystem entry
│   │   ├── lib.rs                # AppState (Mutex<Connection>) + greet + get_app_version
│   │   ├── commands.rs           # Tauri IPC commands: import_book/list_books/delete_book/get_chapter_content
│   │   ├── book/
│   │   │   ├── mod.rs            # FormatRegistry: collects BookFormat impls by extension
│   │   │   ├── format.rs         # BookFormat trait + BookMeta/Chapter structs
│   │   │   ├── epub.rs           # EPUB parser (epub crate): metadata, cover, spine→chapters, HTML content
│   │   │   ├── txt.rs            # TXT parser: encoding detection (BOM→GBK fallback→UTF-8), regex chapter split
│   │   │   └── pdf.rs            # PDF parser: filename-as-title stub, single chapter placeholder
│   │   ├── db/
│   │   │   ├── mod.rs            # init(): create SQLite + WAL mode + refinery migrations
│   │   │   ├── models.rs         # 10 data model structs: Book, Chapter, ReadingProgress, Bookmark, Annotation, BookSource, SyncMeta, ReadingStats, AppSettings
│   │   │   ├── queries.rs        # CRUD: list_books, get_book, insert_book, delete_book, book_exists_by_path, set_setting, get_setting
│   │   │   └── migrations/
│   │   │       └── V1__initial_schema.sql  # 9 tables with FK constraints and unique indexes
│   │   ├── source/               # Phase 5: source rule engine (stubs)
│   │   │   ├── mod.rs
│   │   │   ├── compiler.rs
│   │   │   ├── tokenizer.rs
│   │   │   ├── http.rs
│   │   │   ├── evaluator/        # Css/Xpath/Json/Regex/Js/Template evaluators
│   │   │   └── pipeline/         # Search/BookInfo/ChapterList/ChapterContent pipelines
│   │   └── sync/                 # Phase 6: cross-device sync (stubs)
│   │       ├── mod.rs
│   │       └── webdav.rs
│   ├── Cargo.toml                # Dependencies + lib name: xreader_lib
│   └── tauri.conf.json           # Window 1200×800, min 800×600, identifier: com.xreader.desktop
├── docs/
│   ├── phase-1-completion.md     # Phase 1 report: scaffold, DB schema, CI
│   └── phase-2-completion.md     # Phase 2 report: import, bookshelf UI
├── package.json                  # pnpm scripts: dev, build, lint, format, tauri
├── eslint.config.js              # ESLint 9 flat config
├── .prettierrc                   # Prettier config
├── tsconfig.json                 # Path alias @/ → src/
├── vite.config.ts                # Alias + Tauri HMR config
├── tailwind.config.js            # shadcn color tokens
├── postcss.config.js             # Tailwind + Autoprefixer
└── components.json               # shadcn/ui config (baseColor: slate, cssVariables: true)
```

## Database Schema (V1 — active)

9 tables: `books`, `chapters`, `reading_progress`, `bookmarks`, `annotations`, `book_sources`, `sync_meta`, `reading_stats`, `app_settings`. Migration: `V1__initial_schema.sql` via refinery `embed_migrations!`.

## Conventions

### Rust
- Error handling: `anyhow::Result<T>` in BookFormat trait. Tauri commands convert to `Result<T, String>` via `.map_err(|e| e.to_string())`.
- Book format plugin: implement `BookFormat` trait, register in `FormatRegistry::default()`. New formats are zero-modification to existing code.
- Allow attributes: `#![allow(dead_code, unused_imports)]` at lib.rs — models/query stubs for future phases. Remove when module is fully wired.
- DB path: `directories::ProjectDirs::data_dir() / "xreader.db"`. WAL mode enabled at init.

### Frontend
- Component layers: **Page** (route + layout, no logic) → **Feature** (data loading + state via hooks) → **UI Component** (pure, props only).
- State: Zustand stores in `src/stores/`. One store per domain (books, reader, sources, settings).
- Types: TS types in `src/types/` mirror Rust structs from commands.
- Tauri asset protocol: `convertFileSrc(path)` for `<img>` to load local filesystem paths.
- Path alias: `@/` → `src/` (configured in tsconfig and vite).

### Git
- Branch naming: `feat/<feature>`, `fix/<bug>`, `chore/<misc>`, `docs/<docs>`.
- Commits: [Conventional Commits](https://www.conventionalcommits.org/) — `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- main is protected, push via PR only.

## Commands

```bash
pnpm dev              # Vite dev server (frontend only)
pnpm build            # tsc + vite build
pnpm lint             # ESLint
pnpm format           # Prettier
pnpm tauri dev        # Full Tauri app with hot reload
pnpm tauri build      # Production build (exe + msi + nsis)
pnpm test             # (not yet configured)
```

Rust:
```bash
cargo check           # Type check
cargo test            # Run Rust unit tests
cargo clippy -- -D warnings
cargo fmt --check
```

## Architecture Decisions

1. **Bundled SQLite**: `rusqlite/bundled` — no system SQLite required.
2. **refinery embedded migrations**: `embed_migrations!` inlines SQL at compile time.
3. **Tailwind v3 not v4**: v4 shadcn/ui compatibility not stable.
4. **ESLint 9 flat config**: ESM `eslint.config.js`.
5. **TXT encoding**: `encoding_rs::Encoding::for_bom()` → GBK fallback → UTF-8. No `chardetng` (reduces compile time).
6. **PDF MVP**: filename-as-title only. Full parse and rendering via frontend `pdfjs-dist` (Phase 3).
7. **Chapters written to DB at import time**: reader queries chapters table directly.

## Book Format Architecture

```rust
pub trait BookFormat: Send + Sync {
    fn format_name(&self) -> &'static str;
    fn extensions(&self) -> &[&str];
    fn parse(&self, path: &Path) -> Result<BookMeta>;
    fn extract_cover(&self, path: &Path, output_dir: &Path) -> Result<Option<PathBuf>>;
    fn get_chapters(&self, path: &Path) -> Result<Vec<Chapter>>;
    fn read_chapter(&self, path: &Path, chapter: &Chapter) -> Result<String>;
}
```

`FormatRegistry` maps file extensions → `Box<dyn BookFormat>`. Add new formats by implementing the trait and registering in `create_registry()`.

## Current State & Next Steps

**Done (Phase 1+2)**:
- Tauri scaffold, React + Tailwind + shadcn/ui, ESLint + Prettier
- SQLite with refinery migrations (9 tables)
- Book import: EPUB (metadata/cover/chapters/content), TXT (encoding + regex chapter split), PDF (stub)
- Bookshelf UI: grid/list view, search, import dialog, format badges
- Tauri IPC: import_book, list_books, delete_book, get_chapter_content

**Next: Phase 3 — Reader Core (70-90h)**
- epub.js integration + React component wrapper
- pdf.js rendering component
- TXT reader component (paginated rendering)
- Unified reader shell: pagination/scroll mode toggle
- Font size / line height / margin / theme settings panel
- Reading progress record & restore
- Chapter TOC navigation
- Deliverable: read EPUB, TXT, and PDF books end-to-end

**Future Phases**:
- Phase 4: Bookmarks/highlights/notes + reading stats
- Phase 5: Legado-compatible book source rule engine (Tokenizer→Compiler→6 evaluators→4 pipelines)
- Phase 6: WebDAV cloud sync
- Phase 7: Polish, packaging, auto-update
- Phase 8: TTS, MOBI/AZW3/FB2, dictionary, mobile

## Key Constraints

- Book source engine MUST be 100% Legado JSON format compatible (import/export .txt/.json).
- No private extension fields in book source rules.
- All book formats share the `BookFormat` trait — new formats must not modify existing code.
- `anyhow::Result` for internal errors; Tauri command boundary converts to `String` errors.
