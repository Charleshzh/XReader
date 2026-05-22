# XReader Domain Model & Terminology

## Core Concepts

### Book (书籍)

A reading item in the user's library. Has a format (EPUB/TXT/PDF), source type (local/remote), and metadata (title, author, cover).

- **Local book** (`source_type: "local"`): Imported from filesystem. File at `file_path`, parsed by BookFormat trait impl.
- **Remote book** (`source_type: "remote"`): Discovered via book source. Stored by `source_id` + `source_url`.

### Chapter (章节)

A discrete reading unit within a book. Local books: parsed from file structure (EPUB spine, TXT regex splits). Remote books: crawled from website, cached at `content_path`. Key fields: `index_num` (ordering), `fetched` (cached flag).

### Bookshelf (书架)

The library view. Grid or list layout, virtualized with `@tanstack/react-virtual` for performance with 100+ books. Adaptive column count via ResizeObserver. Supports search by title/author, import via file dialog, delete with cascade.

### Reader (阅读器)

The reading view. EPUB/TXT use `HtmlContentView` (Rust-extracted chapter HTML, `dangerouslySetInnerHTML`). PDF uses `PdfContentView` (pdfjs-dist Canvas, zoom 0.5-3x). Modes: scroll (continuous, debounced progress save) or paginated (click zones: left 30% = prev chapter, right 30% = next). Settings panel: font size (range slider 10-32px), line height (range slider 1.0-3.0x), font family (5 presets incl. system/serif/sans-serif/KaiTi), theme (light/dark/sepia). All reader settings persisted to `app_settings` table. Chapter TOC sidebar for navigation.

### Reading Progress (阅读进度)

Tracks `(book_id, chapter_index, position)` where `position ∈ [0.0, 1.0]` is fraction within chapter. Updated on page turn or scroll position change. Auto-restored on reopen.

### Bookmark (书签)

A named saved position: `(book_id, chapter_index, position, label)`. Jump-to functionality.

### Annotation (笔记/高亮)

A text selection with optional note: `(book_id, chapter_index, start_position, end_position, text, note, color)`. Color preset: yellow/green/blue/pink/orange/purple.

### Reading Stats (阅读统计)

Per-book daily aggregates: `read_seconds` (session timer), `read_words` (estimated from position deltas). Supports daily reading goals.

## Book Source Engine (书源规则引擎) — ✅ Phase 5 implemented

### Book Source (书源)

A JSON rule definition (Legado-compatible format) describing how to scrape a novel website. Contains 5 rule groups: `ruleSearch`, `ruleExplore`, `ruleBookInfo`, `ruleToc`, `ruleContent`. Implementation: `source/tokenizer.rs` → `source/compiler.rs` → `source/evaluator/*.rs` → `source/pipeline/*.rs`.

### Rule String (规则字符串)

A Legado DSL expression using `@` as separator, `.` as selector chain. Structure: `segment1@segment2@...@extract_attribute`. Segments: `type.value.index` (index 0-based, optional).

### Rule Segment Types

| Type       | Syntax                           | Meaning                             |
| ---------- | -------------------------------- | ----------------------------------- |
| `class`    | `class.title.0`                  | Match by CSS class, index=Nth match |
| `id`       | `id.content`                     | Match by element id                 |
| `tag`      | `tag.a.1`                        | Match by tag name                   |
| `text`     | `text.下一章`                    | Match by text content               |
| `children` | `children`                       | All direct children                 |
| `css`      | `css.div.content>p`              | Standard CSS selector               |
| `xpath`    | `xpath.//div[@class='content']`  | W3C XPath 1.0                       |
| `js`       | `js.document.querySelector(...)` | JavaScript expression               |
| `regex`    | `regex.第(\\d+)章.0`             | Regex match                         |
| `json`     | `json.$.data.books[*]`           | JSONPath                            |

### Extract Attributes

`text`, `textNodes`, `ownText`, `href`, `src`, `html`, `all`. Specified after final `@`.

### Operators

- `||`: fallback — try left rule, if empty try right
- `##`: comment separator
- `{{ }}`: URL template variable (`{{key}}`, `{{page}}`)
- `{$. }`: cross-step JSONPath variable (`{$.tocUrl}`)

### Engine Pipeline (5 stages)

1. **Tokenizer**: splits rule string by `@`, `||`, `##` → token stream
2. **Compiler**: parses tokens → Rule AST (`Vec<RuleSegment>`), cached per source
3. **Evaluator**: 6 evaluators (Css/Xpath/Json/Regex/Js/Template) execute against HTML/JSON input
4. **Pipeline**: orchestrates HTTP → evaluate → extract for 5 operations:
   - **Search**: searchUrl → bookList → Vec\<SearchResult\>
   - **Explore**: exploreUrl → exploreBookList → Vec\<ExploreResult\>
   - **BookInfo**: detail page → name/author/cover/intro/tocUrl → BookInfo
   - **ChapterList**: toc page → chapterList → Vec\<Chapter\>
   - **ChapterContent**: chapter page → content + replaceRegex → cleaned HTML

### Discover Page (发现页)

Frontend page at `/discover` that uses the Explore pipeline to show a book source's homepage/ranking/recommendations. Source selector dropdown, paginated book grid with covers. Driven by `explore_books` Tauri command → `ruleExplore` JSON rules.

### Content Cleaning (正文清洗)

`replaceRegex` array in `ruleContent`: regex replacement pairs applied to extracted chapter HTML. Used to strip ads, navigation, site boilerplate.

### Chapter Caching

Remote chapter content cached to disk. Preload: current chapter ± 2 adjacent. TTL: 24 hours. Manual refresh supported.

## Sync (同步) — ✅ Phase 6 implemented

### WebDAV Sync

User provides WebDAV endpoint (e.g. Nutstore/Nextcloud). Sync scope: books metadata, reading progress, bookmarks, annotations, book sources. Strategy: timestamp-based incremental, conflict = latest wins. **Bidirectional**: 3-phase approach (snapshot → network → merge) for full round-trip. Merge handles 5 sync tables with per-row `updated_at` comparison. Implemented in `sync/types.rs` (SyncBackend trait), `sync/webdav.rs` (WebDAV client), `sync/mod.rs` (SyncEngine + SyncSnapshot + merge_row).

```rust
pub trait SyncBackend: Send + Sync {
    async fn upload(&self, key: &str, data: &[u8]) -> Result<()>;
    async fn download(&self, key: &str) -> Result<Vec<u8>>;
    async fn list(&self, prefix: &str) -> Result<Vec<SyncEntry>>;
}
```

Default: WebDAV. Extensible to S3, OneDrive, custom REST.

## Format Support

| Format | Extension    | Parser                     | Renderer                      | Status              |
| ------ | ------------ | -------------------------- | ----------------------------- | ------------------- |
| EPUB   | .epub        | Rust `epub` crate          | HtmlContentView (HTML direct) | ✅ Phase 3 complete |
| TXT    | .txt         | Rust `encoding_rs` + regex | HtmlContentView (HTML direct) | ✅ Phase 3 complete |
| PDF    | .pdf         | filename→title             | PdfContentView (pdfjs-dist)   | ✅ Phase 3 complete |
| MOBI   | .mobi, .azw3 | —                          | —                             | Phase 8             |
| FB2    | .fb2         | —                          | —                             | Phase 8             |

### Preload & Performance (Phase 7)

Chapter prefetch: `loadChapter` triggers background fetch of +/-1 adjacent chapters. Fire-and-forget, best-effort, no cache invalidation needed (Rust/Tauri filesystem cache handles dedup).

### Error Handling (Phase 7)

- `ErrorBoundary` React component wraps all routes — catching render errors with fallback UI
- `env_logger` in Rust backend for structured logging to stderr
- All data-fetching states use Zustand `loading` flags for spinner/empty/error UI states

### Auto-Update (Phase 7)

`tauri-plugin-updater` configured with passive install mode. Update endpoint hosted on GitHub Releases. Permission added to `capabilities/default.json`.

### BookFormat Trait (extensibility)

### Export (导出)

Bookmarks and annotations can be exported to Markdown files. Uses Tauri `save` dialog to pick output path, then `write_file` Rust command. Bookmark export: chapter title + label per entry. Annotation export: chapter title + quoted text + user note.

All format parsers implement `BookFormat`. `FormatRegistry` maps extension → parser. Adding a format = implement trait + register; zero changes to existing code.

### Credential Encryption

Sync credentials (WebDAV URL/username/password) are encrypted before storage in SQLite using ChaCha20-Poly1305. Encryption key derived from machine hostname and username via HMAC-SHA256 (`sync/crypto.rs`). Graceful fallback for legacy plaintext.

### Text Highlighting

Annotations are visually rendered in `HtmlContentView` via `<mark>` elements with color-coded backgrounds (5 colors). The highlight engine maps annotation text to character positions in the HTML content and injects wrap tags. Powered by `useMemo` for performance.

### E2E Testing

Playwright + Chromium. 9 smoke tests: bookshelf empty/import dialog, stats page, source manage, discover page, settings, reader error state. CI job runs on Linux. `pnpm test:e2e`.
