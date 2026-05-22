# XReader — Desktop Novel Reader

Tauri v2 + React 19 + TypeScript desktop app for reading local books (EPUB/TXT/PDF) and web-sourced novels. Legado-compatible book source rule engine planned for Phase 5.

**Status**: Phase 3 complete (reader core). Entering Phase 4 (bookmarks/notes + reading stats).

## Tech Stack

| Layer | Tech | Version |
|-------|------|---------|
| Desktop | Tauri | v2.11.2 |
| UI | React + TypeScript | 19.2.6 / 5.8.3 |
| Build | Vite | 7.3.3 |
| CSS | Tailwind CSS | 3.4.19 |
| Components | shadcn/ui | Button |
| State | Zustand | 5.0.13 |
| Router | react-router-dom | 7.15.1 |
| DB | SQLite (rusqlite bundled) | 0.32.1 |
| Migrations | refinery | 0.8.16 |
| EPUB parse | epub crate | 2.1.5 |
| PDF render | pdfjs-dist (frontend) | 5.7.284 |
| Encoding | encoding_rs | 0.8.35 |
| HTML escape | html-escape | 0.2.13 |
| Error | anyhow | 1.0 |
| Package | pnpm | 11.2.2 |

## Project Structure

```
xreader/
├── src/                          # React frontend
│   ├── main.tsx                  # Entry: ReactDOM.createRoot
│   ├── App.tsx                   # BrowserRouter → / (bookshelf) + /reader/:bookId
│   ├── globals.css               # Tailwind directives + shadcn CSS vars (light/dark/sepia)
│   ├── lib/utils.ts              # cn() helper (clsx + tailwind-merge)
│   ├── types/
│   │   ├── book.ts               # BookItem, ImportResult, ViewMode
│   │   └── reader.ts             # ReaderSettings, ChapterInfo, DEFAULT_SETTINGS
│   ├── stores/
│   │   ├── bookStore.ts          # Zustand: books CRUD, viewMode, loadBooks/importBook/deleteBook
│   │   └── readerStore.ts        # Zustand: openBook, loadChapter, saveProgress, updateSettings, toggleTOC/Settings
│   ├── components/
│   │   ├── ui/
│   │   │   └── button.tsx        # shadcn Button (cva variants: default/destructive/outline/secondary/ghost/link)
│   │   ├── bookshelf/
│   │   │   ├── BookCard.tsx      # Grid card: cover (asset protocol), title, author, format badge, hover-delete
│   │   │   └── ImportDialog.tsx  # Modal: file picker (dialog plugin), multi-select, progress feedback
│   │   └── reader/
│   │       ├── ReaderShell.tsx    # TopBar (back+title+TOC/Settings) + BottomBar (prev/next chapter, progress)
│   │       ├── HtmlContentView.tsx # EPUB/TXT: dangerouslySetInnerHTML, scroll/paginated, debounced progress save
│   │       ├── PdfContentView.tsx  # PDF: pdfjs-dist canvas rendering, zoom (0.5-3x), page nav
│   │       ├── ChapterTOC.tsx     # Left sidebar: chapter list, click-to-jump, current highlight
│   │       └── ReaderSettings.tsx # Right sidebar: font (7 sizes), line-height (6), theme (light/dark/sepia), mode (scroll/page)
│   └── pages/
│       ├── BookshelfPage.tsx     # Main bookshelf: grid/list toggle, search filter, import, empty state
│       └── ReaderPage.tsx        # /reader/:bookId → format routing → HtmlContentView | PdfContentView
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── main.rs               # Windows subsystem entry
│   │   ├── lib.rs                # AppState (Mutex<Connection>), plugin registration, command handler list
│   │   ├── commands.rs           # 6 IPC commands (see Commands section below)
│   │   ├── book/
│   │   │   ├── mod.rs            # create_registry(): registers EpubFormat + TxtFormat + PdfFormat
│   │   │   ├── format.rs         # BookFormat trait + BookMeta + Chapter + FormatRegistry
│   │   │   ├── epub.rs           # EPUB: metadata (mdata.value), cover (get_cover), spine→chapters, HTML content
│   │   │   ├── txt.rs            # TXT: for_bom → GBK→UTF-8 fallback, 5 regex patterns for chapter split
│   │   │   └── pdf.rs            # PDF: filename-as-title, single chapter placeholder (rendered by pdf.js)
│   │   ├── db/
│   │   │   ├── mod.rs            # init(): create SQLite, WAL mode, run refinery migrations
│   │   │   ├── models.rs         # 10 structs: Book, Chapter, ReadingProgress, Bookmark, Annotation, BookSource...
│   │   │   ├── queries.rs        # CRUD + BookListItem (id/title/author/cover/format/file_path/chapters/updated)
│   │   │   └── migrations/
│   │   │       └── V1__initial_schema.sql  # 9 tables with FK constraints, ON DELETE CASCADE, UNIQUE indexes
│   │   ├── source/               # Phase 5: rule engine (stubs)
│   │   └── sync/                 # Phase 6: sync (stubs)
│   ├── Cargo.toml                # Dependencies, lib name: xreader_lib
│   └── tauri.conf.json           # Window 1200×800 min 800×600, identifier: com.xreader.desktop
├── docs/
│   ├── phase-1-completion.md
│   ├── phase-2-completion.md
│   └── phase-3-completion.md
├── .github/workflows/ci.yml      # CI: cargo check+test+clippy+fmt, tsc+eslint+prettier
├── package.json                  # Scripts: dev, build, lint, format, tauri
├── eslint.config.js              # ESLint 9 flat config (tseslint + react-hooks + prettier)
├── .prettierrc
├── tsconfig.json                 # @/ → src/ path alias
├── vite.config.ts                # Path alias + Tauri HMR
├── tailwind.config.js            # shadcn color tokens
└── postcss.config.js
```

## IPC Commands

| Command | Args | Returns | Phase |
|---------|------|---------|-------|
| `greet` | `name: string` | `string` | 1 |
| `get_app_version` | — | `string` | 1 |
| `import_book` | `file_path: string` | `ImportResult` | 2 |
| `list_books` | — | `Vec<BookListItem>` | 2 |
| `delete_book` | `id: string` | `()` | 2 |
| `get_chapter_content` | `book_id, chapter_index` | `string` (HTML) | 2 |
| `get_chapters` | `book_id: string` | `Vec<{index, title}>` | 3 |
| `save_progress` | `book_id, chapter_index, position` | `()` | 3 |

## Reader Architecture

```
BookshelfPage ──navigate(/reader/:id)──→ ReaderPage
                                          │
                          ┌───────────────┴───────────────┐
                     format ≠ "pdf"                   format = "pdf"
                          │                               │
                   HtmlContentView                PdfContentView
                    (dangerouslySetInnerHTML)      (pdf.js Canvas)
                          │                               │
                   scroll/paginated              zoom + page nav

ReaderShell wraps content with:
  TopBar: ←Back | Title · Chapter | 📋TOC ⚙Settings
  Content: flex-1 overflow-hidden
  BottomBar: ◀Prev | N/M | Next▶

Sidebars (fixed overlays, z-40):
  ChapterTOC (left, w-72)  — list of chapters, click-to-jump
  ReaderSettings (right, w-72) — font(7)/line-height(6)/theme(3)/mode(2)
```

## Database Schema (V1 — active)

9 tables via `V1__initial_schema.sql` (refinery `embed_migrations!`):
`books` → `chapters` → `reading_progress` → `bookmarks` → `annotations` → `book_sources` → `sync_meta` → `reading_stats` → `app_settings`

Key details:
- All primary keys are TEXT UUIDs (except `reading_stats.id` INTEGER AUTOINCREMENT, `reading_progress.book_id` as PK)
- `chapters.book_id` FK → `books.id` ON DELETE CASCADE
- `reading_progress` uses UPSERT (INSERT ON CONFLICT DO UPDATE)
- WAL mode enabled at DB init
- Created/updated timestamps are i64 Unix seconds (set by Rust, not SQLite)

## Conventions

### Rust
- **Error handling**: `anyhow::Result<T>` in BookFormat trait. Tauri commands convert to `Result<T, String>` via `.map_err(|e| e.to_string())`.
- **Book format plugin**: implement `BookFormat` trait, register in `create_registry()`. New formats are zero-modification to existing code.
- **Allow attributes**: `#![allow(dead_code, unused_imports)]` at lib.rs — models/queries for future phases. Remove when module is fully wired.
- **DB path**: `directories::ProjectDirs::data_dir() / "xreader.db"`.
- **Chapters at import time**: `import_book` writes chapter rows to `chapters` table; reader queries them directly.

### Frontend
- **Component layers**: Page (route + layout) → Feature (data + state via hooks) → UI Component (pure, props only).
- **State**: One Zustand store per domain: `bookStore`, `readerStore`.
- **Types**: TS types in `src/types/` mirror Rust command return types.
- **Asset protocol**: `convertFileSrc(path)` for `<img src>` and pdf.js to load local filesystem paths.
- **Path alias**: `@/` → `src/` (tsconfig `paths` + vite `resolve.alias`).

### Git
- Branch naming: `feat/<feature>`, `fix/<bug>`, `chore/<misc>`, `docs/<docs>`.
- Commits: [Conventional Commits](https://www.conventionalcommits.org/) — `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- main is protected, push via PR only.

## Commands

```bash
# Frontend
pnpm dev              # Vite dev server (frontend only, port 1420)
pnpm build            # tsc --noEmit + vite build
pnpm lint             # eslint .
pnpm format           # prettier --write src/**/*.{ts,tsx,css}
pnpm tauri dev        # Full Tauri app with hot reload
pnpm tauri build      # Production build (exe + msi + nsis)

# Rust (in src-tauri/)
cargo check           # Type check
cargo test            # Run Rust unit tests
cargo clippy -- -D warnings
cargo fmt --check
cargo fmt             # Auto-format
```

## Architecture Decisions

1. **Bundled SQLite**: `rusqlite/bundled` — no system SQLite required.
2. **refinery embedded migrations**: `embed_migrations!` inlines SQL at compile time, zero runtime dependencies.
3. **Tailwind v3 not v4**: v4 shadcn/ui compatibility not stable as of May 2026.
4. **ESLint 9 flat config**: ESM `eslint.config.js`, integrated with typescript-eslint + react-hooks + prettier.
5. **TXT encoding**: `Encoding::for_bom()` → GBK fallback → UTF-8. Avoids `chardetng` compile time cost.
6. **PDF dual approach**: Rust extracts filename-as-title; frontend pdfjs-dist renders pages on Canvas via Tauri asset protocol.
7. **No epub.js**: Rust backend extracts chapter HTML; frontend renders directly with `dangerouslySetInnerHTML`. Avoids iframe complications and React 19 compat issues.
8. **Chapters persisted at import**: `import_book` writes all chapters to DB; reader never re-parses the file.
9. **CSS Custom Properties for reader styling**: `--margin-h` / `--margin-v` set inline via `style` attribute, avoid className explosion.
10. **Debounced progress save**: 500ms debounce on scroll events before IPC `save_progress` call.

## Book Format Architecture

```rust
pub trait BookFormat: Send + Sync {
    fn format_name(&self) -> &'static str;         // "epub" | "txt" | "pdf"
    fn extensions(&self) -> &[&str];               // ["epub"] | ["txt"]
    fn parse(&self, path: &Path) -> anyhow::Result<BookMeta>;
    fn extract_cover(&self, path: &Path, output_dir: &Path) -> anyhow::Result<Option<PathBuf>>;
    fn get_chapters(&self, path: &Path) -> anyhow::Result<Vec<Chapter>>;
    fn read_chapter(&self, path: &Path, chapter: &Chapter) -> anyhow::Result<String>;
}
```

`FormatRegistry` maps file extensions → `Box<dyn BookFormat>`. Add new formats (MOBI, FB2, etc.) by implementing the trait and registering in `create_registry()` — zero modification to existing code.

## Current State & Next Steps

**Done (Phase 1–3)**:
- Tauri scaffold, React + Tailwind + shadcn/ui, ESLint + Prettier
- SQLite with refinery migrations (9 tables)
- Book import: EPUB (metadata/cover/chapters/content), TXT (BOM→GBK→UTF-8 + regex chapter split), PDF (filename + pdfjs render)
- Bookshelf UI: grid/list, search filter, import dialog, format badges, cover images
- Reader core: unified shell (top/bottom bars, keyboard nav), HTML content renderer, pdf.js Canvas renderer
- Reader features: chapter TOC sidebar, settings panel (font/line-height/theme/mode), scroll progress auto-save
- Tauri IPC: 8 commands covering books CRUD, chapter loading, progress persistence
- CI: GitHub Actions — cargo check/test/clippy/fmt + tsc/eslint/prettier

**Next: Phase 4 — Bookmarks/Notes + Reading Stats (30-50h)**
- Bookmark add/manage UI (per-chapter position labels)
- Text selection + highlight (EPUB/TXT content)
- Note editor panel attached to highlights
- Bookmark/note list with jump navigation, JSON/Markdown export
- Reading timer: session duration tracking, daily/weekly/monthly aggregation
- Word count estimation from progress deltas, daily reading goals
- Stats dashboard with charts (recharts)

**Future Phases**:
- Phase 5: Legado-compatible book source rule engine (Tokenizer→Compiler→6 evaluators→4 pipelines)
- Phase 6: WebDAV cloud sync
- Phase 7: Polish, packaging, auto-update
- Phase 8: TTS, MOBI/AZW3/FB2, dictionary, mobile

## Key Constraints

- Book source engine MUST be 100% Legado JSON format compatible (import/export .txt/.json).
- No private extension fields in book source rules.
- All book formats share the `BookFormat` trait — new formats must not modify existing code.
- `anyhow::Result` for internal errors; Tauri command boundary converts to `String` errors.
