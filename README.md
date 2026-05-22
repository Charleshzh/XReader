# XReader — Desktop Novel Reader

Tauri v2 desktop app for reading local books (EPUB/TXT/PDF) and web-sourced novels.

**Status**: Phase 3 complete — bookshelf + reader core working. Entering Phase 4 (bookmarks/notes/stats).

## Quick Start

```bash
pnpm install
pnpm tauri dev
```

## Features (Implemented)

- **Book import**: EPUB (metadata/cover/chapters), TXT (GBK/UTF-8/Big5 encoding, regex chapter detection), PDF
- **Bookshelf**: grid/list views, search filter, cover images, format badges, multi-file import
- **Reader**: EPUB/TXT HTML rendering (scroll/paginated), PDF canvas rendering (pdf.js), zoom, chapter navigation
- **Reader settings**: font size (14-28px), line height (1.4-2.5x), theme (light/dark/sepia), scroll/page mode
- **Chapter TOC**: sidebar chapter list with jump navigation
- **Reading progress**: auto-save scroll position, restore on reopen

## Tech Stack

| Layer | Tech |
|-------|------|
| Desktop | Tauri v2 + Rust |
| Frontend | React 19 + TypeScript 5.8 + Vite 7 |
| CSS | Tailwind CSS 3 + shadcn/ui |
| State | Zustand 5 |
| Database | SQLite (rusqlite bundled) |
| PDF | pdfjs-dist 5.7 |

## Commands

```bash
pnpm dev           # Vite dev server (port 1420)
pnpm build         # tsc + vite build
pnpm lint          # ESLint
pnpm format        # Prettier
pnpm tauri dev     # Full Tauri app
pnpm tauri build   # Production build
```

In `src-tauri/`:
```bash
cargo check        # Type check
cargo test         # Unit tests
cargo clippy -- -D warnings
cargo fmt --check
```

## Project Docs

- `CLAUDE.md` — full project reference (architecture, conventions, stack)
- `docs/phase-1-completion.md` — Phase 1 report
- `docs/phase-2-completion.md` — Phase 2 report
- `docs/phase-3-completion.md` — Phase 3 report
- `docs/CONTEXT.md` — domain model & terminology
