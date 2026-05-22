# XReader Reader Evolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move XReader’s reader from its current MVP shape toward a Legado-class desktop reading experience by shipping the approved P1→P5 roadmap in a staged, test-backed way.

**Architecture:** Keep the existing Tauri + React + Zustand split, but evolve the reader into four explicit subsystems: reader baseline/remote-book closure, style system, interaction system, and reading-assist system. Preserve the current SQLite schema where it still works (especially `reading_progress.position` as a 0..1 chapter fraction), reuse the existing `books.source_type/source_id/source_url` and `chapters.url/content_path/fetched` fields for remote reading, and extend the frontend reader settings from a flat object into a versioned, migratable state tree.

**Tech Stack:** React 19, TypeScript 5.8, Zustand, Tauri v2, Rust, SQLite, Playwright, Vitest, Web Speech API, OpenCC JS.

---

## Prerequisite

Do **not** start this plan until the engineering hardening plan at `docs/superpowers/plans/2026-05-22-xreader-engineering-hardening.md` is complete. This plan assumes:

- frontend unit tests already run in CI
- route smoke tests no longer swallow runtime errors
- current-state docs and test counts are already accurate

---

## File Map

### Existing frontend files that evolve through most phases
- `src/types/book.ts` — extend book identity with remote metadata
- `src/types/reader.ts` — evolve from flat reader settings to a versioned reader-state tree
- `src/pages/ReaderPage.tsx` — reader entry orchestration and deep-link behavior
- `src/pages/SearchPage.tsx` — search result actions
- `src/pages/DiscoverPage.tsx` — discover result actions
- `src/stores/bookStore.ts` — bookshelf + remote-book insertion
- `src/stores/readerStore.ts` — reader runtime, persisted settings, page state, assistive features
- `src/components/reader/ReaderShell.tsx` — top bar, bottom bar, toolbar, search/TTS controls
- `src/components/reader/HtmlContentView.tsx` — HTML rendering, pagination, tap zones, search marks
- `src/components/reader/ReaderSettings.tsx` — reader settings entry point
- `src/components/reader/BookmarkPanel.tsx`
- `src/components/reader/ChapterTOC.tsx`
- `src/components/reader/AnnotationPanel.tsx`

### New frontend files introduced by this plan
- `src/lib/migrateReaderSettings.ts` — backward migration from current flat settings JSON
- `src/lib/paginatedLayout.ts` — page-fraction helpers for column pagination
- `src/lib/tapZones.ts` — 9-grid region resolution and action dispatch mapping
- `src/lib/contentSearch.ts` — reader content search helpers
- `src/lib/chinese.ts` — simplified/traditional conversion wrapper
- `src/lib/tts.ts` — utterance chunking helpers
- `src/types/readerBundle.ts` — import/export manifest for reader bundles
- `src/hooks/useTts.ts` — Web Speech API lifecycle wrapper
- `src/components/reader/StylePresetList.tsx`
- `src/components/reader/ReaderTypographyPanel.tsx`
- `src/components/reader/ReaderChromePanel.tsx`
- `src/components/reader/TapZoneConfigPanel.tsx`
- `src/components/reader/ReaderSearchPanel.tsx`
- `src/components/reader/ReaderBundleButtons.tsx`

### Existing backend files that evolve through most phases
- `src-tauri/src/lib.rs` — register any new Tauri commands
- `src-tauri/src/commands.rs` — remote-book insertion, local/remote chapter branching, and reader-bundle helpers
- `src-tauri/src/db/models.rs` — may expose chapter records more directly to commands
- `src-tauri/src/db/queries.rs` — chapter queries + remote-book persistence helpers
- `src-tauri/src/source/pipeline/book_info.rs`
- `src-tauri/src/source/pipeline/chapter_list.rs`
- `src-tauri/src/source/pipeline/chapter_content.rs` — remote-reading pipeline reuse and chapter caching

---

### Task 1: Stabilize reader entry and save exact bookmark/progress positions (P1)

**Files:**
- Modify: `src/stores/bookStore.ts`
- Modify: `src/pages/ReaderPage.tsx`
- Modify: `src/stores/readerStore.ts`
- Modify: `src/components/reader/BookmarkPanel.tsx`
- Test: `src/stores/__tests__/readerProgress.test.ts`
- Test: `src/stores/__tests__/bookStore.readerEntry.test.ts`

- [ ] **Step 1: Write the failing tests for deep-linking and bookmark position**

```ts
// src/stores/__tests__/bookStore.readerEntry.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { useBookStore } from "@/stores/bookStore";

const mockInvoke = vi.mocked(invoke);

describe("bookStore reader entry support", () => {
  beforeEach(() => {
    useBookStore.setState({ books: [], loading: false, viewMode: "grid", loaded: false });
    mockInvoke.mockReset();
  });

  it("marks the store as loaded after loadBooks succeeds", async () => {
    mockInvoke.mockResolvedValueOnce([]);
    await useBookStore.getState().loadBooks();
    expect(useBookStore.getState().loaded).toBe(true);
  });

  it("marks the store as loaded even when loadBooks fails", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("db down"));
    await useBookStore.getState().loadBooks();
    expect(useBookStore.getState().loaded).toBe(true);
    expect(useBookStore.getState().loading).toBe(false);
  });
});
```

```ts
// src/stores/__tests__/readerProgress.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { useReaderStore } from "@/stores/readerStore";

const mockInvoke = vi.mocked(invoke);
const book = {
  id: "b1",
  title: "测试书",
  author: "作者",
  cover_path: "",
  format: "epub",
  file_path: "demo.epub",
  total_chapters: 3,
  updated_at: 1,
};

describe("reader progress and bookmark position", () => {
  beforeEach(() => {
    useReaderStore.setState({
      ...useReaderStore.getState(),
      book,
      chapters: [{ index: 0, title: "第一章" }],
      currentChapter: 0,
      currentPosition: 0,
      bookmarks: [],
    });
    mockInvoke.mockReset();
  });

  it("tracks currentPosition when saveProgress runs", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await useReaderStore.getState().saveProgress(0, 0.42);
    expect(useReaderStore.getState().currentPosition).toBe(0.42);
  });

  it("uses currentPosition when creating a bookmark", async () => {
    useReaderStore.setState({ currentPosition: 0.42 });
    mockInvoke.mockResolvedValueOnce({ id: "bm-1" }).mockResolvedValueOnce([]);
    await useReaderStore.getState().addBookmark("进度点");
    expect(mockInvoke).toHaveBeenCalledWith("add_bookmark", {
      bookId: "b1",
      chapterIndex: 0,
      position: 0.42,
      label: "进度点",
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/stores/__tests__/bookStore.readerEntry.test.ts src/stores/__tests__/readerProgress.test.ts`

Expected: FAIL because `bookStore` has no `loaded` flag and `readerStore` does not track `currentPosition`.

- [ ] **Step 3: Add the minimum runtime state needed for stable entry and exact bookmarks**

```ts
// src/stores/bookStore.ts
interface BookState {
  books: BookItem[];
  loading: boolean;
  loaded: boolean;
  viewMode: ViewMode;
  loadBooks: () => Promise<void>;
  importBook: (filePath: string) => Promise<ImportResult>;
  deleteBook: (id: string) => Promise<void>;
  setViewMode: (mode: ViewMode) => void;
  addRemoteBook: (sourceId: string, bookUrl: string) => Promise<ImportResult>;
}

export const useBookStore = create<BookState>((set, get) => ({
  books: [],
  loading: false,
  loaded: false,
  viewMode: "grid",
  loadBooks: async () => {
    set({ loading: true });
    try {
      const books = await invoke<BookItem[]>("list_books");
      set({ books, loading: false, loaded: true });
    } catch (err) {
      console.error("Failed to load books:", err);
      set({ loading: false, loaded: true });
    }
  },
  importBook: async (filePath) => {
    const result = await invoke<ImportResult>("import_book", { filePath });
    await get().loadBooks();
    return result;
  },
  deleteBook: async (id) => {
    await invoke("delete_book", { id });
    await get().loadBooks();
  },
  setViewMode: (mode) => set({ viewMode: mode }),
  addRemoteBook: async (sourceId, bookUrl) => {
    const result = await invoke<ImportResult>("add_remote_book", { sourceId, bookUrl });
    await get().loadBooks();
    return result;
  },
}));
```

```tsx
// src/pages/ReaderPage.tsx
export function ReaderPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const {
    book,
    content,
    loading,
    currentChapter,
    chapters,
    tocOpen,
    settingsOpen,
    bookmarksOpen,
    annotationsOpen,
  } = useReaderStore();
  const { books, loaded, loadBooks } = useBookStore();

  useEffect(() => {
    if (!bookId) return;
    if (!loaded) {
      loadBooks();
      return;
    }
    const target = books.find((b) => b.id === bookId);
    if (target) {
      useReaderStore.getState().openBook(target);
    } else {
      navigate("/", { replace: true });
    }
  }, [bookId, books, loaded, loadBooks, navigate]);

  if (!loaded || !book) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isPdf = book.format === "pdf";

  return (
    <div className="relative h-screen overflow-hidden bg-background">
      <ReaderShell
        title={book.title}
        chapterTitle={chapters[currentChapter]?.title || ""}
        onBack={() => navigate("/")}
      >
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : isPdf ? (
          <PdfContentView filePath={book.file_path} />
        ) : (
          <HtmlContentView content={content} />
        )}
      </ReaderShell>
      {tocOpen && <ChapterTOC />}
      {settingsOpen && <ReaderSettings />}
      {bookmarksOpen && <BookmarkPanel />}
      {annotationsOpen && <AnnotationPanel />}
    </div>
  );
}
```

```ts
// src/stores/readerStore.ts
interface ReaderState {
  book: BookItem | null;
  chapters: ChapterInfo[];
  currentChapter: number;
  currentPosition: number;
  content: string;
  loading: boolean;
  settingsState: ReaderSettingsState;
  activeStyle: ReaderStylePreset;
  tocOpen: boolean;
  settingsOpen: boolean;
  bookmarks: BookmarkItem[];
  bookmarksOpen: boolean;
  annotations: AnnotationItem[];
  annotationsOpen: boolean;
  selectedAnnotation: AnnotationItem | null;
  sessionSeconds: number;
  sessionWords: number;
  isReading: boolean;
}

export const useReaderStore = create<ReaderState>((set, get) => ({
  book: null,
  chapters: [],
  currentChapter: 0,
  currentPosition: 0,
  content: "",
  loading: false,
  settingsState: DEFAULT_READER_SETTINGS_STATE,
  activeStyle: DEFAULT_READER_SETTINGS_STATE.styles[0],
  tocOpen: false,
  settingsOpen: false,
  bookmarks: [],
  bookmarksOpen: false,
  annotations: [],
  annotationsOpen: false,
  selectedAnnotation: null,
  sessionSeconds: 0,
  sessionWords: 0,
  isReading: false,
  openBook: async (book) => {
    set({ book, loading: true, currentChapter: 0, currentPosition: 0, bookmarks: [], annotations: [] });
    try {
      const chaptersRaw = await invoke<{ index: number; title: string }[]>("get_chapters", { bookId: book.id });
      const chapters = chaptersRaw.map((c) => ({ index: c.index, title: c.title || `第${c.index + 1}章` }));
      const content = await invoke<string>("get_chapter_content", { bookId: book.id, chapterIndex: 0 });
      set({ chapters, content, loading: false });
      get().loadSavedSettings();
      get().loadBookmarks();
      get().loadAnnotations();
      get().startSession();
    } catch (err) {
      console.error("Failed to open book:", err);
      set({ loading: false });
    }
  },
  loadChapter: async (index) => {
    const { book } = get();
    if (!book) return;
    set({ loading: true, currentChapter: index, currentPosition: 0 });
    try {
      const content = await invoke<string>("get_chapter_content", { bookId: book.id, chapterIndex: index });
      set({ content, loading: false });
      get().loadAnnotations();
    } catch (err) {
      console.error("Failed to load chapter:", err);
      set({ loading: false });
    }
  },
  saveProgress: async (chapterIndex, position) => {
    set({ currentPosition: position });
    try {
      await invoke("save_progress", {
        bookId: get().book?.id,
        chapterIndex,
        position,
      });
    } catch (err) {
      console.error("Failed to save progress:", err);
    }
  },
  addBookmark: async (label) => {
    const { book, currentChapter, currentPosition } = get();
    if (!book) return;
    await invoke("add_bookmark", {
      bookId: book.id,
      chapterIndex: currentChapter,
      position: currentPosition,
      label,
    });
    await get().loadBookmarks();
  },
}));
```

- [ ] **Step 4: Run the targeted tests and confirm they pass**

Run: `pnpm exec vitest run src/stores/__tests__/bookStore.readerEntry.test.ts src/stores/__tests__/readerProgress.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/bookStore.ts src/pages/ReaderPage.tsx src/stores/readerStore.ts src/components/reader/BookmarkPanel.tsx src/stores/__tests__/bookStore.readerEntry.test.ts src/stores/__tests__/readerProgress.test.ts
git commit -m "feat: stabilize reader entry and exact bookmark progress"
```

### Task 2: Bridge remote books from search/discover into the reader (P1)

**Files:**
- Modify: `src/types/book.ts`
- Modify: `src/stores/bookStore.ts`
- Modify: `src/pages/SearchPage.tsx`
- Modify: `src/pages/DiscoverPage.tsx`
- Modify: `src-tauri/src/db/queries.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: `src/stores/__tests__/bookStore.remote.test.ts`
- Test: `src-tauri/src/commands.rs`

- [ ] **Step 1: Write the failing tests for remote-book insertion and UI actions**

```ts
// src/stores/__tests__/bookStore.remote.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { useBookStore } from "@/stores/bookStore";

const mockInvoke = vi.mocked(invoke);

describe("bookStore remote books", () => {
  beforeEach(() => {
    useBookStore.setState({ books: [], loading: false, loaded: true, viewMode: "grid" });
    mockInvoke.mockReset();
  });

  it("adds a remote book and refreshes the shelf", async () => {
    mockInvoke
      .mockResolvedValueOnce({ id: "remote-1", title: "远程书", author: "作者", cover_path: "", format: "remote", total_chapters: 12, message: "ok" })
      .mockResolvedValueOnce([
        { id: "remote-1", title: "远程书", author: "作者", cover_path: "", format: "remote", file_path: "", total_chapters: 12, updated_at: 1, source_type: "remote", source_id: "src-1", source_url: "https://example.com/book" },
      ]);

    const result = await useBookStore.getState().addRemoteBook("src-1", "https://example.com/book");

    expect(result.id).toBe("remote-1");
    expect(mockInvoke).toHaveBeenCalledWith("add_remote_book", {
      sourceId: "src-1",
      bookUrl: "https://example.com/book",
    });
    expect(useBookStore.getState().books[0]?.source_type).toBe("remote");
  });
});
```

```rust
// src-tauri/src/commands.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_remote_book_list_item_keeps_source_metadata() {
        let book = crate::db::models::Book {
            id: "remote-1".into(),
            title: "远程书".into(),
            author: "作者".into(),
            cover_path: "".into(),
            file_path: "".into(),
            format: "remote".into(),
            source_type: "remote".into(),
            source_id: "src-1".into(),
            source_url: "https://example.com/book".into(),
            total_chapters: 12,
            created_at: 1,
            updated_at: 1,
        };

        let item = crate::db::queries::BookListItem::from(book);
        assert_eq!(item.source_type, "remote");
        assert_eq!(item.source_id, "src-1");
        assert_eq!(item.source_url, "https://example.com/book");
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/stores/__tests__/bookStore.remote.test.ts`

Expected: FAIL because `addRemoteBook` and the extra `BookItem` metadata do not exist yet.

- [ ] **Step 3: Extend the book shape and add the remote-book command path**

```ts
// src/types/book.ts
export interface BookItem {
  id: string;
  title: string;
  author: string;
  cover_path: string;
  format: "epub" | "txt" | "pdf" | "remote";
  file_path: string;
  total_chapters: number;
  updated_at: number;
  source_type: "local" | "remote";
  source_id: string;
  source_url: string;
}
```

```ts
// src/stores/bookStore.ts
interface BookState {
  books: BookItem[];
  loading: boolean;
  loaded: boolean;
  viewMode: ViewMode;
  loadBooks: () => Promise<void>;
  importBook: (filePath: string) => Promise<ImportResult>;
  deleteBook: (id: string) => Promise<void>;
  setViewMode: (mode: ViewMode) => void;
  addRemoteBook: (sourceId: string, bookUrl: string) => Promise<ImportResult>;
}

export const useBookStore = create<BookState>((set, get) => ({
  books: [],
  loading: false,
  loaded: true,
  viewMode: "grid",
  loadBooks: async () => {
    set({ loading: true });
    try {
      const books = await invoke<BookItem[]>("list_books");
      set({ books, loading: false, loaded: true });
    } catch (err) {
      console.error("Failed to load books:", err);
      set({ loading: false, loaded: true });
    }
  },
  importBook: async (filePath) => {
    const result = await invoke<ImportResult>("import_book", { filePath });
    await get().loadBooks();
    return result;
  },
  deleteBook: async (id) => {
    await invoke("delete_book", { id });
    await get().loadBooks();
  },
  setViewMode: (mode) => set({ viewMode: mode }),
  addRemoteBook: async (sourceId, bookUrl) => {
    const result = await invoke<ImportResult>("add_remote_book", { sourceId, bookUrl });
    await get().loadBooks();
    return result;
  },
}));
```
```

```rust
// src-tauri/src/db/queries.rs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookListItem {
    pub id: String,
    pub title: String,
    pub author: String,
    pub cover_path: String,
    pub format: String,
    pub file_path: String,
    pub total_chapters: i64,
    pub updated_at: i64,
    pub source_type: String,
    pub source_id: String,
    pub source_url: String,
}

impl From<Book> for BookListItem {
    fn from(b: Book) -> Self {
        Self {
            id: b.id,
            title: b.title,
            author: b.author,
            file_path: b.file_path,
            cover_path: b.cover_path,
            format: b.format,
            total_chapters: b.total_chapters,
            updated_at: b.updated_at,
            source_type: b.source_type,
            source_id: b.source_id,
            source_url: b.source_url,
        }
    }
}

pub fn list_remote_chapters(conn: &Connection, book_id: &str) -> Result<Vec<super::models::Chapter>> {
    let mut stmt = conn.prepare(
        "SELECT id, book_id, index_num, title, url, content_path, word_count, fetched FROM chapters WHERE book_id = ?1 ORDER BY index_num ASC",
    )?;
    let rows = stmt.query_map(params![book_id], |row| {
        Ok(super::models::Chapter {
            id: row.get(0)?,
            book_id: row.get(1)?,
            index_num: row.get(2)?,
            title: row.get(3)?,
            url: row.get(4)?,
            content_path: row.get(5)?,
            word_count: row.get(6)?,
            fetched: row.get::<_, i64>(7)? != 0,
        })
    })?;
    rows.collect()
}

pub fn upsert_remote_chapter(conn: &Connection, chapter: &super::models::Chapter) -> Result<()> {
    conn.execute(
        "INSERT INTO chapters (id, book_id, index_num, title, url, content_path, word_count, fetched)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(book_id, index_num) DO UPDATE SET
           title = excluded.title,
           url = excluded.url,
           content_path = excluded.content_path,
           word_count = excluded.word_count,
           fetched = excluded.fetched",
        params![
            chapter.id,
            chapter.book_id,
            chapter.index_num,
            chapter.title,
            chapter.url,
            chapter.content_path,
            chapter.word_count,
            chapter.fetched as i64,
        ],
    )?;
    Ok(())
}
```

```rust
// src-tauri/src/commands.rs
#[tauri::command]
pub async fn add_remote_book(
    state: State<'_, AppState>,
    source_id: String,
    book_url: String,
) -> Result<ImportResult, String> {
    let (json_str, now) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let json_str: String = db
            .query_row(
                "SELECT rule_json FROM book_sources WHERE id = ?1",
                rusqlite::params![source_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        (json_str, now)
    };

    let json_val: serde_json::Value = serde_json::from_str(&json_str).map_err(|e| e.to_string())?;
    let compiled = crate::source::compile_source(&json_val).map_err(|e| e.to_string())?;
    let mut pipeline = crate::source::SourcePipeline::new(compiled);
    let info = pipeline.get_book_info(&book_url).await?;
    let chapters = pipeline.get_chapter_list(&info.toc_url).await?;

    let id = uuid::Uuid::new_v4().to_string();
    let record = crate::db::models::Book {
        id: id.clone(),
        title: info.name.clone(),
        author: info.author.clone(),
        cover_path: info.cover_url.clone(),
        file_path: String::new(),
        format: "remote".into(),
        source_type: "remote".into(),
        source_id: source_id.clone(),
        source_url: book_url.clone(),
        total_chapters: chapters.len() as i64,
        created_at: now,
        updated_at: now,
    };

    let db = state.db.lock().map_err(|e| e.to_string())?;
    crate::db::queries::insert_book(&db, &record).map_err(|e| e.to_string())?;
    for item in chapters {
        let chapter = crate::db::models::Chapter {
            id: format!("{}-{}", id, item.index),
            book_id: id.clone(),
            index_num: item.index as i64,
            title: item.name,
            url: item.url,
            content_path: String::new(),
            word_count: 0,
            fetched: false,
        };
        crate::db::queries::upsert_remote_chapter(&db, &chapter).map_err(|e| e.to_string())?;
    }

    Ok(ImportResult {
        id,
        title: info.name,
        author: info.author,
        cover_path: info.cover_url,
        format: "remote".into(),
        total_chapters: chapters.len(),
        message: "Successfully imported remote book".into(),
    })
}

pub fn get_chapters(state: State<AppState>, book_id: String) -> Result<Vec<ChapterItem>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let book = crate::db::queries::get_book(&db, &book_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Book not found".to_string())?;

    if book.source_type == "remote" {
        let chapters = crate::db::queries::list_remote_chapters(&db, &book.id)
            .map_err(|e| e.to_string())?
            .into_iter()
            .map(|c| ChapterItem { index: c.index_num as usize, title: c.title })
            .collect::<Vec<_>>();
        return Ok(chapters);
    }

    let path = PathBuf::from(&book.file_path);
    let registry = book::create_registry();
    let format = registry
        .find_for(&path)
        .ok_or_else(|| "Unsupported format".to_string())?;

    let chapters = format
        .get_chapters(&path)
        .map_err(|e| format!("Failed to load chapters: {}", e))?;

    Ok(chapters
        .into_iter()
        .map(|c| ChapterItem {
            index: c.index,
            title: c.title,
        })
        .collect())
}
```

```rust
// src-tauri/src/lib.rs
.invoke_handler(tauri::generate_handler![
    greet,
    get_app_version,
    commands::import_book,
    commands::add_remote_book,
    commands::list_books,
    commands::delete_book,
    commands::get_chapter_content,
    commands::get_chapters,
])
```

```tsx
// src/pages/SearchPage.tsx
const { addRemoteBook } = useBookStore();

<Button
  variant="outline"
  onClick={async () => {
    const result = await addRemoteBook(sourceId, r.book_url);
    navigate(`/reader/${result.id}`);
  }}
>
  加入书架
</Button>
```

```tsx
// src/pages/DiscoverPage.tsx
const { addRemoteBook } = useBookStore();

<Button
  size="sm"
  onClick={async (e) => {
    e.stopPropagation();
    const result = await addRemoteBook(activeSourceId, book.book_url);
    navigate(`/reader/${result.id}`);
  }}
>
  加入书架
</Button>
```

- [ ] **Step 4: Run the remote-book tests and targeted smoke**

Run: `pnpm exec vitest run src/stores/__tests__/bookStore.remote.test.ts`

Expected: PASS.

Run: `cargo test test_remote_book_list_item_keeps_source_metadata --quiet`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types/book.ts src/stores/bookStore.ts src/pages/SearchPage.tsx src/pages/DiscoverPage.tsx src-tauri/src/db/queries.rs src-tauri/src/commands.rs src-tauri/src/lib.rs src/stores/__tests__/bookStore.remote.test.ts
git commit -m "feat: bridge remote books into the reader"
```

### Task 3: Introduce a versioned style-state schema and migrate existing reader settings (P2)

**Files:**
- Create: `src/lib/migrateReaderSettings.ts`
- Modify: `src/types/reader.ts`
- Modify: `src/stores/readerStore.ts`
- Test: `src/lib/migrateReaderSettings.test.ts`

- [ ] **Step 1: Write the failing migration tests**

```ts
// src/lib/migrateReaderSettings.test.ts
import { describe, expect, it } from "vitest";
import { migrateReaderSettings } from "@/lib/migrateReaderSettings";

describe("migrateReaderSettings", () => {
  it("upgrades the current flat settings shape into the new state tree", () => {
    const migrated = migrateReaderSettings({
      fontSize: 18,
      lineHeight: 1.8,
      marginH: 5,
      marginV: 40,
      theme: "light",
      scrollMode: "paginated",
      fontFamily: "system-ui, -apple-system, sans-serif",
    });

    expect(migrated.version).toBe(1);
    expect(migrated.styles).toHaveLength(1);
    expect(migrated.styles[0].fontSize).toBe(18);
    expect(migrated.interaction.scrollMode).toBe("paginated");
  });

  it("returns defaults when the payload is invalid", () => {
    const migrated = migrateReaderSettings("not-json-compatible");
    expect(migrated.styles).toHaveLength(1);
    expect(migrated.activeStyleId).toBe(migrated.styles[0].id);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/migrateReaderSettings.test.ts`

Expected: FAIL because the migration helper and the new schema do not exist yet.

- [ ] **Step 3: Replace the flat settings type with a versioned state tree**

```ts
// src/types/reader.ts
export type ReaderTheme = "light" | "dark" | "sepia" | "green" | "gray" | "black";
export type TitleMode = "left" | "center" | "hidden";
export type ChromeItem = "none" | "chapter" | "clock" | "progress" | "book";

export interface ReaderChromeRow {
  left: ChromeItem;
  center: ChromeItem;
  right: ChromeItem;
  showDivider: boolean;
}

export interface ReaderStylePreset {
  id: string;
  name: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  paragraphSpacing: number;
  paragraphIndent: number;
  fontFamily: string;
  fontWeight: "normal" | "medium" | "bold";
  marginH: number;
  marginV: number;
  theme: ReaderTheme;
  titleMode: TitleMode;
  titleSize: number;
  header: ReaderChromeRow;
  footer: ReaderChromeRow;
  backgroundImage?: string;
}

export interface InteractionSettings {
  scrollMode: "scroll" | "paginated";
  pageTurn: "none" | "slide" | "cover" | "fade";
  autoPageSeconds: number | null;
}

export interface AssistSettings {
  chineseMode: "original" | "simplified" | "traditional";
  ttsRate: number;
  searchCaseSensitive: boolean;
}

export interface ReaderSettingsState {
  version: 1;
  activeStyleId: string;
  styles: ReaderStylePreset[];
  interaction: InteractionSettings;
  assist: AssistSettings;
}

export const DEFAULT_STYLE_PRESET: ReaderStylePreset = {
  id: "default",
  name: "默认",
  fontSize: 18,
  lineHeight: 1.8,
  letterSpacing: 0,
  paragraphSpacing: 0,
  paragraphIndent: 2,
  fontFamily: "system-ui, -apple-system, sans-serif",
  fontWeight: "normal",
  marginH: 5,
  marginV: 40,
  theme: "light",
  titleMode: "left",
  titleSize: 20,
  header: { left: "book", center: "none", right: "clock", showDivider: false },
  footer: { left: "chapter", center: "none", right: "progress", showDivider: true },
};

export const DEFAULT_READER_SETTINGS_STATE: ReaderSettingsState = {
  version: 1,
  activeStyleId: DEFAULT_STYLE_PRESET.id,
  styles: [DEFAULT_STYLE_PRESET],
  interaction: { scrollMode: "paginated", pageTurn: "none", autoPageSeconds: null },
  assist: { chineseMode: "original", ttsRate: 1, searchCaseSensitive: false },
};
```

```ts
// src/lib/migrateReaderSettings.ts
import {
  DEFAULT_READER_SETTINGS_STATE,
  type ReaderSettingsState,
  type ReaderStylePreset,
} from "@/types/reader";

function fromFlatSettings(value: Record<string, unknown>): ReaderSettingsState {
  const style: ReaderStylePreset = {
    ...DEFAULT_READER_SETTINGS_STATE.styles[0],
    fontSize: Number(value.fontSize ?? DEFAULT_READER_SETTINGS_STATE.styles[0].fontSize),
    lineHeight: Number(value.lineHeight ?? DEFAULT_READER_SETTINGS_STATE.styles[0].lineHeight),
    marginH: Number(value.marginH ?? DEFAULT_READER_SETTINGS_STATE.styles[0].marginH),
    marginV: Number(value.marginV ?? DEFAULT_READER_SETTINGS_STATE.styles[0].marginV),
    fontFamily: String(value.fontFamily ?? DEFAULT_READER_SETTINGS_STATE.styles[0].fontFamily),
    theme: (value.theme as ReaderStylePreset["theme"]) ?? DEFAULT_READER_SETTINGS_STATE.styles[0].theme,
  };

  return {
    version: 1,
    activeStyleId: style.id,
    styles: [style],
    interaction: {
      ...DEFAULT_READER_SETTINGS_STATE.interaction,
      scrollMode: (value.scrollMode as ReaderSettingsState["interaction"]["scrollMode"]) ?? DEFAULT_READER_SETTINGS_STATE.interaction.scrollMode,
    },
    assist: DEFAULT_READER_SETTINGS_STATE.assist,
  };
}

export function migrateReaderSettings(value: unknown): ReaderSettingsState {
  if (!value || typeof value !== "object") {
    return DEFAULT_READER_SETTINGS_STATE;
  }

  if ((value as { version?: number }).version === 1 && Array.isArray((value as ReaderSettingsState).styles)) {
    return value as ReaderSettingsState;
  }

  return fromFlatSettings(value as Record<string, unknown>);
}
```

```ts
// src/stores/readerStore.ts
import { DEFAULT_READER_SETTINGS_STATE } from "@/types/reader";
import { migrateReaderSettings } from "@/lib/migrateReaderSettings";

interface ReaderState {
  book: BookItem | null;
  chapters: ChapterInfo[];
  currentChapter: number;
  currentPosition: number;
  content: string;
  loading: boolean;
  settingsState: ReaderSettingsState;
  activeStyle: ReaderStylePreset;
  tocOpen: boolean;
  settingsOpen: boolean;
  bookmarks: BookmarkItem[];
  bookmarksOpen: boolean;
  annotations: AnnotationItem[];
  annotationsOpen: boolean;
  selectedAnnotation: AnnotationItem | null;
  sessionSeconds: number;
  sessionWords: number;
  isReading: boolean;
}

export const useReaderStore = create<ReaderState>((set, get) => ({
  book: null,
  chapters: [],
  currentChapter: 0,
  currentPosition: 0,
  content: "",
  loading: false,
  settingsState: DEFAULT_READER_SETTINGS_STATE,
  activeStyle: DEFAULT_READER_SETTINGS_STATE.styles[0],
  tocOpen: false,
  settingsOpen: false,
  bookmarks: [],
  bookmarksOpen: false,
  annotations: [],
  annotationsOpen: false,
  selectedAnnotation: null,
  sessionSeconds: 0,
  sessionWords: 0,
  isReading: false,
  updateSettingsState: (next) => {
    set({ settingsState: next, activeStyle: next.styles.find((s) => s.id === next.activeStyleId) ?? next.styles[0] });
    invoke("save_reader_settings", { settingsJson: JSON.stringify(next) }).catch(() => {});
  },
  loadSavedSettings: async () => {
    try {
      const json = await invoke<string>("load_reader_settings");
      if (!json) return;
      const parsed = migrateReaderSettings(JSON.parse(json));
      set({ settingsState: parsed, activeStyle: parsed.styles.find((s) => s.id === parsed.activeStyleId) ?? parsed.styles[0] });
    } catch {}
  },
}));
```

- [ ] **Step 4: Run the migration tests**

Run: `pnpm exec vitest run src/lib/migrateReaderSettings.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/migrateReaderSettings.ts src/lib/migrateReaderSettings.test.ts src/types/reader.ts src/stores/readerStore.ts
git commit -m "feat: introduce migratable reader style state"
```

### Task 4: Build the style UI around presets, typography, and chrome slots (P2)

**Files:**
- Create: `src/components/reader/StylePresetList.tsx`
- Create: `src/components/reader/ReaderTypographyPanel.tsx`
- Create: `src/components/reader/ReaderChromePanel.tsx`
- Modify: `src/components/reader/ReaderSettings.tsx`
- Modify: `src/components/reader/ReaderShell.tsx`
- Modify: `src/components/reader/HtmlContentView.tsx`
- Test: `src/components/reader/__tests__/ReaderSettings.test.tsx`

- [ ] **Step 1: Write the failing UI test for preset editing and chrome updates**

```tsx
// src/components/reader/__tests__/ReaderSettings.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReaderSettings } from "@/components/reader/ReaderSettings";
import { useReaderStore } from "@/stores/readerStore";

it("switches presets and updates typography controls", async () => {
  const user = userEvent.setup();
  useReaderStore.setState({
    ...useReaderStore.getState(),
    settingsState: {
      version: 1,
      activeStyleId: "default",
      styles: [
        { ...useReaderStore.getState().settingsState.styles[0], id: "default", name: "默认" },
        { ...useReaderStore.getState().settingsState.styles[0], id: "night", name: "夜读", theme: "dark" },
      ],
      interaction: useReaderStore.getState().settingsState.interaction,
      assist: useReaderStore.getState().settingsState.assist,
    },
    activeStyle: { ...useReaderStore.getState().settingsState.styles[0], id: "default", name: "默认" },
  });

  render(<ReaderSettings />);

  await user.click(screen.getByRole("button", { name: "夜读" }));

  expect(useReaderStore.getState().settingsState.activeStyleId).toBe("night");
  expect(screen.getByText("页眉")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the UI test to verify it fails**

Run: `pnpm exec vitest run src/components/reader/__tests__/ReaderSettings.test.tsx`

Expected: FAIL because the preset list and chrome panels do not exist yet.

- [ ] **Step 3: Replace the single flat settings pane with preset-aware panels**

```tsx
// src/components/reader/StylePresetList.tsx
import { useReaderStore } from "@/stores/readerStore";
import { Button } from "@/components/ui/button";

export function StylePresetList() {
  const { settingsState, selectStylePreset, createStylePreset, deleteStylePreset } = useReaderStore();
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground">样式预设</h3>
        <Button size="sm" variant="outline" onClick={() => createStylePreset("新样式")}>新增</Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {settingsState.styles.map((style) => (
          <button
            key={style.id}
            className={`rounded-lg border p-3 text-left ${settingsState.activeStyleId === style.id ? "border-primary bg-accent" : "border-border"}`}
            onClick={() => selectStylePreset(style.id)}
          >
            <div className="font-medium">{style.name}</div>
            <div className="text-xs text-muted-foreground">{style.theme} · {style.fontSize}px</div>
          </button>
        ))}
      </div>
      {settingsState.styles.length > 1 ? (
        <Button size="sm" variant="ghost" onClick={() => deleteStylePreset(settingsState.activeStyleId)}>删除当前样式</Button>
      ) : null}
    </section>
  );
}
```

```tsx
// src/components/reader/ReaderTypographyPanel.tsx
import { useReaderStore } from "@/stores/readerStore";

export function ReaderTypographyPanel() {
  const { activeStyle, patchActiveStyle } = useReaderStore();
  return (
    <section className="space-y-4">
      <h3 className="text-xs font-medium text-muted-foreground">排版</h3>
      <label className="block text-xs">字号 {activeStyle.fontSize}px</label>
      <input type="range" min={10} max={40} value={activeStyle.fontSize} onChange={(e) => patchActiveStyle({ fontSize: Number(e.target.value) })} />
      <label className="block text-xs">行高 {activeStyle.lineHeight.toFixed(1)}x</label>
      <input type="range" min={10} max={30} value={Math.round(activeStyle.lineHeight * 10)} onChange={(e) => patchActiveStyle({ lineHeight: Number(e.target.value) / 10 })} />
      <label className="block text-xs">字间距 {activeStyle.letterSpacing}</label>
      <input type="range" min={-1} max={6} step={0.1} value={activeStyle.letterSpacing} onChange={(e) => patchActiveStyle({ letterSpacing: Number(e.target.value) })} />
      <label className="block text-xs">段距 {activeStyle.paragraphSpacing}</label>
      <input type="range" min={0} max={24} value={activeStyle.paragraphSpacing} onChange={(e) => patchActiveStyle({ paragraphSpacing: Number(e.target.value) })} />
    </section>
  );
}
```

```tsx
// src/components/reader/ReaderChromePanel.tsx
import { useReaderStore } from "@/stores/readerStore";

const items = ["none", "book", "chapter", "clock", "progress"] as const;

export function ReaderChromePanel() {
  const { activeStyle, patchActiveStyle } = useReaderStore();
  const updateFooter = (slot: "left" | "center" | "right", value: typeof items[number]) => {
    patchActiveStyle({ footer: { ...activeStyle.footer, [slot]: value } });
  };

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-medium text-muted-foreground">页眉 / 页脚</h3>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <select value={activeStyle.footer.left} onChange={(e) => updateFooter("left", e.target.value as typeof items[number])}>
          {items.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select value={activeStyle.footer.center} onChange={(e) => updateFooter("center", e.target.value as typeof items[number])}>
          {items.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select value={activeStyle.footer.right} onChange={(e) => updateFooter("right", e.target.value as typeof items[number])}>
          {items.map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>
    </section>
  );
}
```

```tsx
// src/components/reader/ReaderSettings.tsx
import { StylePresetList } from "@/components/reader/StylePresetList";
import { ReaderTypographyPanel } from "@/components/reader/ReaderTypographyPanel";
import { ReaderChromePanel } from "@/components/reader/ReaderChromePanel";

export function ReaderSettings() {
  const { toggleSettings } = useReaderStore();
  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-80 flex-col border-l bg-background shadow-xl">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">阅读设置</h2>
        <Button variant="ghost" size="icon" onClick={toggleSettings}><X className="h-4 w-4" /></Button>
      </div>
      <div className="flex-1 space-y-6 overflow-auto p-4">
        <StylePresetList />
        <ReaderTypographyPanel />
        <ReaderChromePanel />
      </div>
    </div>
  );
}
```

```tsx
// src/components/reader/ReaderShell.tsx
const renderChromeItem = (item: ChromeItem) => {
  switch (item) {
    case "book":
      return title;
    case "chapter":
      return chapterTitle;
    case "clock":
      return new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    case "progress":
      return `${currentChapter + 1}/${chapters.length}`;
    default:
      return "";
  }
};
```

```tsx
// src/components/reader/HtmlContentView.tsx
const { fontSize, lineHeight, marginH, marginV, fontFamily, fontWeight, letterSpacing, paragraphSpacing } = activeStyle;

<article
  className="mx-auto min-h-full max-w-3xl px-[var(--margin-h)] py-[var(--margin-v)]"
  style={{
    "--margin-h": `${marginH}%`,
    "--margin-v": `${marginV}px`,
    fontSize: `${fontSize}px`,
    lineHeight,
    fontFamily,
    fontWeight,
    letterSpacing: `${letterSpacing}px`,
    textIndent: `${paragraphIndent}em`,
    wordSpacing: `${paragraphSpacing}px`,
  } as React.CSSProperties}
  dangerouslySetInnerHTML={{ __html: highlightedContent }}
/>
```

- [ ] **Step 4: Run the UI test and manual reader smoke**

Run: `pnpm exec vitest run src/components/reader/__tests__/ReaderSettings.test.tsx`

Expected: PASS.

Then run: `pnpm dev`

Expected: The reader settings sidebar shows preset management, typography controls, and header/footer slot controls without breaking current reading.

- [ ] **Step 5: Commit**

```bash
git add src/components/reader/StylePresetList.tsx src/components/reader/ReaderTypographyPanel.tsx src/components/reader/ReaderChromePanel.tsx src/components/reader/ReaderSettings.tsx src/components/reader/ReaderShell.tsx src/components/reader/HtmlContentView.tsx src/components/reader/__tests__/ReaderSettings.test.tsx
git commit -m "feat: add preset-based reader style system"
```

### Task 5: Implement true paginated mode with page-position tracking (P3)

**Files:**
- Create: `src/lib/paginatedLayout.ts`
- Modify: `src/stores/readerStore.ts`
- Modify: `src/components/reader/HtmlContentView.tsx`
- Modify: `src/components/reader/ReaderShell.tsx`
- Test: `src/lib/paginatedLayout.test.ts`
- Test: `src/components/reader/__tests__/HtmlContentView.pagination.test.tsx`

- [ ] **Step 1: Write the failing pagination tests**

```ts
// src/lib/paginatedLayout.test.ts
import { describe, expect, it } from "vitest";
import { toChapterFraction, clampPageIndex } from "@/lib/paginatedLayout";

describe("paginatedLayout", () => {
  it("converts a page index into a 0..1 chapter fraction", () => {
    expect(toChapterFraction(0, 5)).toBe(0);
    expect(toChapterFraction(2, 5)).toBeCloseTo(0.5);
    expect(toChapterFraction(4, 5)).toBe(1);
  });

  it("clamps out-of-range page indexes", () => {
    expect(clampPageIndex(-1, 5)).toBe(0);
    expect(clampPageIndex(7, 5)).toBe(4);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/paginatedLayout.test.ts`

Expected: FAIL because the helper file does not exist yet.

- [ ] **Step 3: Add the page-fraction helper and wire it into the reader runtime**

```ts
// src/lib/paginatedLayout.ts
export function clampPageIndex(page: number, totalPages: number): number {
  if (totalPages <= 0) return 0;
  return Math.max(0, Math.min(page, totalPages - 1));
}

export function toChapterFraction(page: number, totalPages: number): number {
  if (totalPages <= 1) return 0;
  return clampPageIndex(page, totalPages) / (totalPages - 1);
}
```

```ts
// src/stores/readerStore.ts
// add to the ReaderState interface
currentPage: number;
totalPages: number;
setPageState: (page: number, totalPages: number) => void;
nextPage: () => Promise<void>;
prevPage: () => Promise<void>;

// add to the store initializer
currentPage: 0,
totalPages: 1,
setPageState: (page, totalPages) => {
    set({ currentPage: page, totalPages });
    const fraction = toChapterFraction(page, totalPages);
    void get().saveProgress(get().currentChapter, fraction);
  },
  nextPage: async () => {
    const { currentPage, totalPages, currentChapter, chapters } = get();
    if (currentPage + 1 < totalPages) {
      return set({ currentPage: currentPage + 1 });
    }
    if (currentChapter < chapters.length - 1) {
      await get().loadChapter(currentChapter + 1);
    }
  },
  prevPage: async () => {
    const { currentPage, currentChapter } = get();
    if (currentPage > 0) {
      return set({ currentPage: currentPage - 1 });
    }
    if (currentChapter > 0) {
      await get().loadChapter(currentChapter - 1);
    }
  },
}));
```

```tsx
// src/components/reader/HtmlContentView.tsx
const { activeStyle, settingsState, currentChapter, saveProgress, nextChapter, prevChapter, setPageState, currentPage } = useReaderStore();
const isPaginated = settingsState.interaction.scrollMode === "paginated";

useEffect(() => {
  const el = containerRef.current;
  if (!el || !isPaginated) return;

  const width = el.clientWidth;
  const pages = Math.max(1, Math.ceil(el.scrollWidth / Math.max(width, 1)));
  setPageState(0, pages);
}, [content, isPaginated, setPageState]);

const goToPage = useCallback((page: number) => {
  const el = containerRef.current;
  if (!el) return;
  const next = clampPageIndex(page, totalPages);
  el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  setPageState(next, totalPages);
}, [setPageState, totalPages]);

const handleContentClick = useCallback((e: React.MouseEvent) => {
  if (!isPaginated) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const x = e.clientX - rect.left;
  if (x < rect.width * 0.3) {
    void prevPage();
  } else if (x > rect.width * 0.7) {
    void nextPage();
  }
}, [isPaginated, prevPage, nextPage]);

<article
  className="mx-auto min-h-full max-w-3xl px-[var(--margin-h)] py-[var(--margin-v)]"
  style={isPaginated ? {
    columnWidth: "calc(100vw - 2rem)",
    columnGap: 0,
    height: "100%",
  } : undefined}
  dangerouslySetInnerHTML={{ __html: highlightedContent }}
/>
```

```tsx
// src/components/reader/ReaderShell.tsx
const { currentChapter, chapters, currentPage, totalPages, settingsState, nextPage, prevPage } = useReaderStore();
const isPaginated = settingsState.interaction.scrollMode === "paginated";

<footer className="flex h-10 shrink-0 items-center justify-between border-t border-border/50 px-4 text-xs text-muted-foreground">
  <Button variant="ghost" size="sm" onClick={prevPage} disabled={currentChapter === 0 && currentPage === 0}>
    <ChevronLeft className="mr-1 h-3 w-3" />
    {isPaginated ? "上一页" : "上一章"}
  </Button>
  <span>{isPaginated ? `第 ${currentPage + 1} / ${totalPages} 页` : `${currentChapter + 1} / ${chapters.length}`}</span>
  <Button variant="ghost" size="sm" onClick={nextPage}>
    {isPaginated ? "下一页" : "下一章"}
    <ChevronRight className="ml-1 h-3 w-3" />
  </Button>
</footer>
```

- [ ] **Step 4: Run the pagination tests and manual reader QA**

Run: `pnpm exec vitest run src/lib/paginatedLayout.test.ts`

Expected: PASS.

Then run: `pnpm dev`

Expected: In paginated mode, chapter content advances page-by-page within the chapter, and the saved progress remains a 0..1 chapter fraction.

- [ ] **Step 5: Commit**

```bash
git add src/lib/paginatedLayout.ts src/lib/paginatedLayout.test.ts src/stores/readerStore.ts src/components/reader/HtmlContentView.tsx src/components/reader/ReaderShell.tsx
git commit -m "feat: add page-aware paginated reader mode"
```

### Task 6: Add configurable tap zones and auto-page actions (P3)

**Files:**
- Create: `src/lib/tapZones.ts`
- Create: `src/components/reader/TapZoneConfigPanel.tsx`
- Modify: `src/types/reader.ts`
- Modify: `src/stores/readerStore.ts`
- Modify: `src/components/reader/HtmlContentView.tsx`
- Modify: `src/components/reader/ReaderSettings.tsx`
- Test: `src/lib/tapZones.test.ts`
- Test: `src/stores/__tests__/readerInteraction.test.ts`

- [ ] **Step 1: Write the failing interaction tests**

```ts
// src/lib/tapZones.test.ts
import { describe, expect, it } from "vitest";
import { resolveTapZone } from "@/lib/tapZones";

describe("resolveTapZone", () => {
  it("maps a point to a 3x3 region", () => {
    expect(resolveTapZone({ x: 10, y: 10, width: 300, height: 300 })).toBe("tl");
    expect(resolveTapZone({ x: 150, y: 150, width: 300, height: 300 })).toBe("mc");
    expect(resolveTapZone({ x: 280, y: 280, width: 300, height: 300 })).toBe("br");
  });
});
```

```ts
// src/stores/__tests__/readerInteraction.test.ts
import { describe, expect, it, vi } from "vitest";
import { useReaderStore } from "@/stores/readerStore";

describe("reader interaction actions", () => {
  it("dispatches tap actions through the configured zone map", async () => {
    const nextPage = vi.spyOn(useReaderStore.getState(), "nextPage").mockResolvedValue();
    useReaderStore.setState({
      settingsState: {
        ...useReaderStore.getState().settingsState,
        interaction: {
          ...useReaderStore.getState().settingsState.interaction,
          tapZones: { tl: "menu", tc: "noop", tr: "next-page", ml: "prev-page", mc: "menu", mr: "next-page", bl: "bookmark", bc: "search", br: "next-chapter" },
        },
      },
    });

    await useReaderStore.getState().dispatchTapAction("tr");
    expect(nextPage).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/lib/tapZones.test.ts src/stores/__tests__/readerInteraction.test.ts`

Expected: FAIL because the tap-zone helper and action dispatcher do not exist yet.

- [ ] **Step 3: Add a 9-zone map, action dispatcher, and auto-page timer**

```ts
// src/types/reader.ts
export type TapZone = "tl" | "tc" | "tr" | "ml" | "mc" | "mr" | "bl" | "bc" | "br";
export type TapAction = "noop" | "menu" | "next-page" | "prev-page" | "next-chapter" | "prev-chapter" | "bookmark" | "search" | "tts-toggle";

export interface InteractionSettings {
  scrollMode: "scroll" | "paginated";
  pageTurn: "none" | "slide" | "cover" | "fade";
  autoPageSeconds: number | null;
  tapZones: Record<TapZone, TapAction>;
}
```

```ts
// src/lib/tapZones.ts
import type { TapZone } from "@/types/reader";

export function resolveTapZone({ x, y, width, height }: { x: number; y: number; width: number; height: number }): TapZone {
  const col = x < width / 3 ? "l" : x < (width * 2) / 3 ? "c" : "r";
  const row = y < height / 3 ? "t" : y < (height * 2) / 3 ? "m" : "b";
  return `${row}${col}` as TapZone;
}
```

```ts
// src/stores/readerStore.ts
// add to the ReaderState interface
showSearchPanel: boolean;
dispatchTapAction: (zone: TapZone) => Promise<void>;

// add to the store initializer
showSearchPanel: false,
  dispatchTapAction: async (zone) => {
    const action = get().settingsState.interaction.tapZones[zone];
    switch (action) {
      case "next-page":
        await get().nextPage();
        break;
      case "prev-page":
        await get().prevPage();
        break;
      case "next-chapter":
        await get().nextChapter();
        break;
      case "prev-chapter":
        await get().prevChapter();
        break;
      case "bookmark":
        await get().addBookmark("书签");
        break;
      case "search":
        set({ showSearchPanel: true });
        break;
      default:
        break;
    }
  },
}));
```

```tsx
// src/components/reader/HtmlContentView.tsx
import { resolveTapZone } from "@/lib/tapZones";

const { dispatchTapAction, settingsState } = useReaderStore();

const handleContentClick = useCallback((e: React.MouseEvent) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const zone = resolveTapZone({
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
    width: rect.width,
    height: rect.height,
  });
  void dispatchTapAction(zone);
}, [dispatchTapAction]);
```

```tsx
// src/components/reader/TapZoneConfigPanel.tsx
import type { TapAction, TapZone } from "@/types/reader";
import { useReaderStore } from "@/stores/readerStore";

const zones: TapZone[] = ["tl", "tc", "tr", "ml", "mc", "mr", "bl", "bc", "br"];
const actions: TapAction[] = ["noop", "menu", "next-page", "prev-page", "next-chapter", "prev-chapter", "bookmark", "search", "tts-toggle"];

export function TapZoneConfigPanel() {
  const { settingsState, patchInteraction } = useReaderStore();
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-medium text-muted-foreground">点击区域</h3>
      <div className="grid grid-cols-3 gap-2">
        {zones.map((zone) => (
          <label key={zone} className="flex flex-col gap-1 rounded border p-2 text-xs">
            <span>{zone.toUpperCase()}</span>
            <select
              value={settingsState.interaction.tapZones[zone]}
              onChange={(e) => patchInteraction({ tapZones: { ...settingsState.interaction.tapZones, [zone]: e.target.value as TapAction } })}
            >
              {actions.map((action) => <option key={action} value={action}>{action}</option>)}
            </select>
          </label>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run the interaction tests and manual auto-page QA**

Run: `pnpm exec vitest run src/lib/tapZones.test.ts src/stores/__tests__/readerInteraction.test.ts`

Expected: PASS.

Then run: `pnpm dev`

Expected: Taps dispatch the configured action instead of the old fixed left/right logic.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tapZones.ts src/lib/tapZones.test.ts src/components/reader/TapZoneConfigPanel.tsx src/types/reader.ts src/stores/readerStore.ts src/components/reader/HtmlContentView.tsx src/components/reader/ReaderSettings.tsx src/stores/__tests__/readerInteraction.test.ts
git commit -m "feat: add configurable reader tap zones"
```

### Task 7: Add content search and Chinese conversion in the reader (P4)

**Files:**
- Create: `src/lib/contentSearch.ts`
- Create: `src/lib/chinese.ts`
- Modify: `package.json`
- Modify: `src/components/reader/HtmlContentView.tsx`
- Modify: `src/components/reader/ReaderShell.tsx`
- Modify: `src/components/reader/ReaderSettings.tsx`
- Create: `src/components/reader/ReaderSearchPanel.tsx`
- Test: `src/lib/contentSearch.test.ts`
- Test: `src/lib/chinese.test.ts`

- [ ] **Step 1: Write the failing tests for content search and conversion**

```ts
// src/lib/contentSearch.test.ts
import { describe, expect, it } from "vitest";
import { findContentMatches } from "@/lib/contentSearch";

describe("findContentMatches", () => {
  it("finds case-insensitive matches in stripped html", () => {
    const matches = findContentMatches("<p>雪中 悍刀行</p><p>雪中</p>", "雪中", false);
    expect(matches).toHaveLength(2);
  });
});
```

```ts
// src/lib/chinese.test.ts
import { describe, expect, it } from "vitest";
import { convertChinese } from "@/lib/chinese";

describe("convertChinese", () => {
  it("keeps original text in original mode", () => {
    expect(convertChinese("original", "繁體中文")).toBe("繁體中文");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/contentSearch.test.ts src/lib/chinese.test.ts`

Expected: FAIL because the helpers and `opencc-js` dependency are missing.

- [ ] **Step 3: Add search helpers, conversion helpers, and reader UI**

Run once: `pnpm add opencc-js`

```ts
// src/lib/contentSearch.ts
export interface ContentMatch {
  text: string;
  index: number;
}

export function findContentMatches(html: string, query: string, caseSensitive: boolean): ContentMatch[] {
  if (!query.trim()) return [];
  const text = html.replace(/<[^>]*>/g, "");
  const source = caseSensitive ? text : text.toLowerCase();
  const needle = caseSensitive ? query : query.toLowerCase();
  const matches: ContentMatch[] = [];
  let idx = 0;
  while (idx < source.length) {
    const found = source.indexOf(needle, idx);
    if (found === -1) break;
    matches.push({ text: text.slice(found, found + needle.length), index: found });
    idx = found + needle.length;
  }
  return matches;
}
```

```ts
// src/lib/chinese.ts
import OpenCC from "opencc-js";

const toSimplified = OpenCC.Converter({ from: "hk", to: "cn" });
const toTraditional = OpenCC.Converter({ from: "cn", to: "hk" });

export function convertChinese(mode: "original" | "simplified" | "traditional", text: string): string {
  switch (mode) {
    case "simplified":
      return toSimplified(text);
    case "traditional":
      return toTraditional(text);
    default:
      return text;
  }
}
```

```tsx
// src/components/reader/ReaderSearchPanel.tsx
import { useState } from "react";
import { useReaderStore } from "@/stores/readerStore";

export function ReaderSearchPanel() {
  const { searchQuery, setSearchQuery, searchMatches, currentSearchIndex, jumpToSearchMatch, closeSearchPanel } = useReaderStore();
  const [value, setValue] = useState(searchQuery);

  return (
    <div className="fixed inset-x-0 top-12 z-40 border-b bg-background p-3 shadow">
      <div className="flex gap-2">
        <input className="h-9 flex-1 rounded border px-3 text-sm" value={value} onChange={(e) => setValue(e.target.value)} placeholder="搜索正文..." />
        <button className="rounded border px-3 text-sm" onClick={() => setSearchQuery(value)}>搜索</button>
        <button className="rounded border px-3 text-sm" onClick={closeSearchPanel}>关闭</button>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        {searchMatches.length > 0 ? `第 ${currentSearchIndex + 1} / ${searchMatches.length} 个结果` : "无结果"}
      </div>
    </div>
  );
}
```

```tsx
// src/components/reader/ReaderShell.tsx
import { Search } from "lucide-react";

<Button variant="ghost" size="icon" onClick={() => useReaderStore.setState({ showSearchPanel: true })}>
  <Search className="h-4 w-4" />
</Button>
```

```tsx
// src/components/reader/HtmlContentView.tsx
const { settingsState, searchQuery, searchMatches, setSearchMatches, activeStyle } = useReaderStore();
const convertedContent = useMemo(
  () => convertChinese(settingsState.assist.chineseMode, content),
  [content, settingsState.assist.chineseMode],
);

useEffect(() => {
  setSearchMatches(findContentMatches(convertedContent, searchQuery, settingsState.assist.searchCaseSensitive));
}, [convertedContent, searchQuery, settingsState.assist.searchCaseSensitive, setSearchMatches]);

const highlightedContent = useMemo(() => {
  const withAnnotations = highlightAnnotations(convertedContent, chapterAnnotations);
  if (!searchQuery.trim()) return withAnnotations;
  return withAnnotations.replaceAll(searchQuery, `<mark class="bg-primary/30 rounded-sm">${searchQuery}</mark>`);
}, [convertedContent, chapterAnnotations, searchQuery]);
```

- [ ] **Step 4: Run the helper tests and manual reader QA**

Run: `pnpm exec vitest run src/lib/contentSearch.test.ts src/lib/chinese.test.ts`

Expected: PASS.

Then run: `pnpm dev`

Expected: The reader can search within a chapter and toggle original/简体/繁體 rendering.

- [ ] **Step 5: Commit**

```bash
git add package.json src/lib/contentSearch.ts src/lib/contentSearch.test.ts src/lib/chinese.ts src/lib/chinese.test.ts src/components/reader/ReaderSearchPanel.tsx src/components/reader/ReaderShell.tsx src/components/reader/ReaderSettings.tsx src/components/reader/HtmlContentView.tsx
git commit -m "feat: add reader search and chinese conversion"
```

### Task 8: Add system TTS with Web Speech controls (P4)

**Files:**
- Create: `src/lib/tts.ts`
- Create: `src/hooks/useTts.ts`
- Modify: `src/stores/readerStore.ts`
- Modify: `src/components/reader/ReaderShell.tsx`
- Modify: `src/components/reader/ReaderSettings.tsx`
- Test: `src/lib/tts.test.ts`
- Test: `src/hooks/__tests__/useTts.test.ts`

- [ ] **Step 1: Write the failing chunking and hook tests**

```ts
// src/lib/tts.test.ts
import { describe, expect, it } from "vitest";
import { splitIntoUtteranceChunks } from "@/lib/tts";

describe("splitIntoUtteranceChunks", () => {
  it("splits long text into bounded utterance chunks", () => {
    const text = "第一句。".repeat(2000);
    const chunks = splitIntoUtteranceChunks(text, 2000);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 2000)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/tts.test.ts`

Expected: FAIL because the helper and hook do not exist yet.

- [ ] **Step 3: Add a Web Speech hook and TTS controls**

```ts
// src/lib/tts.ts
export function splitIntoUtteranceChunks(text: string, maxLength = 2000): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const sentence of text.split(/(?<=[。！？!?])/)) {
    if (!sentence) continue;
    if ((current + sentence).length > maxLength && current) {
      chunks.push(current);
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
```

```ts
// src/hooks/useTts.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { splitIntoUtteranceChunks } from "@/lib/tts";

export function useTts(text: string, rate: number) {
  const [playing, setPlaying] = useState(false);
  const queueRef = useRef<SpeechSynthesisUtterance[]>([]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    queueRef.current = [];
    setPlaying(false);
  }, []);

  const play = useCallback(() => {
    stop();
    const chunks = splitIntoUtteranceChunks(text);
    queueRef.current = chunks.map((chunk) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.lang = "zh-CN";
      utterance.rate = rate;
      utterance.onstart = () => setPlaying(true);
      utterance.onend = () => {
        if (utterance === queueRef.current[queueRef.current.length - 1]) {
          setPlaying(false);
        }
      };
      return utterance;
    });
    queueRef.current.forEach((utterance) => window.speechSynthesis.speak(utterance));
  }, [rate, stop, text]);

  useEffect(() => stop, [stop]);

  return { playing, play, stop };
}
```

```tsx
// src/components/reader/ReaderPage.tsx
import { htmlToSpeechText } from "@/lib/tts";

<ReaderShell
  title={book.title}
  chapterTitle={chapters[currentChapter]?.title || ""}
  ttsText={book.format === "pdf" ? "" : htmlToSpeechText(content)}
  onBack={() => navigate("/")}
>
```

```tsx
// src/components/reader/ReaderShell.tsx
import { Volume2, VolumeX } from "lucide-react";
import { useTts } from "@/hooks/useTts";

interface ReaderShellProps {
  title: string;
  chapterTitle: string;
  ttsText: string;
  onBack: () => void;
  children: ReactNode;
}

const { ttsText, title, chapterTitle, onBack, children } = props;
const { playing, play, stop } = useTts(ttsText, settingsState.assist.ttsRate);

<Button variant="ghost" size="icon" onClick={playing ? stop : play}>
  {playing ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
</Button>
```

```tsx
// src/components/reader/ReaderSettings.tsx
<label className="mb-1 flex justify-between text-xs">
  <span className="text-muted-foreground">朗读速度</span>
  <span className="font-medium">{settingsState.assist.ttsRate.toFixed(1)}x</span>
</label>
<input
  type="range"
  min={0.5}
  max={2}
  step={0.1}
  value={settingsState.assist.ttsRate}
  onChange={(e) => patchAssist({ ttsRate: Number(e.target.value) })}
/>
```

- [ ] **Step 4: Run the TTS helper test and manual QA**

Run: `pnpm exec vitest run src/lib/tts.test.ts`

Expected: PASS.

Then run: `pnpm dev`

Expected: The reader can start and stop system TTS for the visible chapter with a configurable speed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tts.ts src/lib/tts.test.ts src/hooks/useTts.ts src/stores/readerStore.ts src/components/reader/ReaderShell.tsx src/components/reader/ReaderSettings.tsx
git commit -m "feat: add system tts controls"
```

### Task 9: Export/import reader bundles and define the extension manifest boundary (P5)

**Files:**
- Create: `src/types/readerBundle.ts`
- Create: `src/components/reader/ReaderBundleButtons.tsx`
- Modify: `src/components/reader/ReaderSettings.tsx`
- Test: `src/types/readerBundle.test.ts`

- [ ] **Step 1: Write the failing bundle validation test**

```ts
// src/types/readerBundle.test.ts
import { describe, expect, it } from "vitest";
import { isReaderBundle } from "@/types/readerBundle";

describe("isReaderBundle", () => {
  it("accepts a v1 XReader reader bundle", () => {
    expect(
      isReaderBundle({
        kind: "xreader-reader-bundle",
        version: 1,
        exportedAt: "2026-05-22T00:00:00.000Z",
        settings: {
          version: 1,
          activeStyleId: "default",
          styles: [],
          interaction: { scrollMode: "paginated", pageTurn: "none", autoPageSeconds: null, tapZones: {} },
          assist: { chineseMode: "original", ttsRate: 1, searchCaseSensitive: false },
        },
        extensions: {},
      }),
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run the bundle test to verify it fails**

Run: `pnpm exec vitest run src/types/readerBundle.test.ts`

Expected: FAIL because the bundle type and validator do not exist yet.

- [ ] **Step 3: Add the bundle manifest and import/export buttons**

```ts
// src/types/readerBundle.ts
import type { ReaderSettingsState } from "@/types/reader";

export interface ReaderBundle {
  kind: "xreader-reader-bundle";
  version: 1;
  exportedAt: string;
  settings: ReaderSettingsState;
  extensions: {
    voices?: string[];
    dictionaries?: string[];
  };
}

export function isReaderBundle(value: unknown): value is ReaderBundle {
  return !!value && typeof value === "object" && (value as ReaderBundle).kind === "xreader-reader-bundle" && (value as ReaderBundle).version === 1;
}
```

```tsx
// src/components/reader/ReaderBundleButtons.tsx
import { useRef } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useReaderStore } from "@/stores/readerStore";
import type { ReaderBundle } from "@/types/readerBundle";
import { isReaderBundle } from "@/types/readerBundle";

export function ReaderBundleButtons() {
  const { settingsState, replaceSettingsState } = useReaderStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const exportBundle = async () => {
    const path = await save({
      defaultPath: `xreader-reader-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return;

    const bundle: ReaderBundle = {
      kind: "xreader-reader-bundle",
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: settingsState,
      extensions: {},
    };

    await invoke("write_file", { path, content: JSON.stringify(bundle, null, 2) });
  };

  const importBundle = async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!isReaderBundle(parsed)) throw new Error("Invalid XReader reader bundle");
    replaceSettingsState(parsed.settings);
  };

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-medium text-muted-foreground">导入 / 导出</h3>
      <div className="flex gap-2">
        <button className="rounded border px-3 py-2 text-xs" onClick={exportBundle}>导出配置包</button>
        <button className="rounded border px-3 py-2 text-xs" onClick={() => inputRef.current?.click()}>导入配置包</button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importBundle(file);
        }}
      />
    </section>
  );
}
```

```tsx
// src/components/reader/ReaderSettings.tsx
import { ReaderBundleButtons } from "@/components/reader/ReaderBundleButtons";

<div className="flex-1 space-y-6 overflow-auto p-4">
  <StylePresetList />
  <ReaderTypographyPanel />
  <ReaderChromePanel />
  <TapZoneConfigPanel />
  <ReaderBundleButtons />
</div>
```

This deliberately defines the extension boundary (`extensions.voices`, `extensions.dictionaries`) without yet implementing full Legado-style dict-rule or HTTP-TTS package execution. The import/export surface is real; the extension lists are forward-compatible.

- [ ] **Step 4: Run the bundle test and manual import/export QA**

Run: `pnpm exec vitest run src/types/readerBundle.test.ts`

Expected: PASS.

Then run: `pnpm dev`

Expected: Export writes a valid JSON reader bundle; import replaces the current reader settings state after validation.

- [ ] **Step 5: Commit**

```bash
git add src/types/readerBundle.ts src/types/readerBundle.test.ts src/components/reader/ReaderBundleButtons.tsx src/components/reader/ReaderSettings.tsx
git commit -m "feat: add importable reader bundles"
```

### Task 10: Final roadmap verification checkpoint

**Files:**
- Modify: none
- Test: targeted suites + smoke + manual reader QA

- [ ] **Step 1: Run the reader-focused unit suites**

Run: `pnpm exec vitest run src/lib/migrateReaderSettings.test.ts src/lib/paginatedLayout.test.ts src/lib/tapZones.test.ts src/lib/contentSearch.test.ts src/lib/chinese.test.ts src/lib/tts.test.ts src/types/readerBundle.test.ts src/stores/__tests__/readerProgress.test.ts src/stores/__tests__/readerInteraction.test.ts`

Expected: PASS.

- [ ] **Step 2: Run the route smoke suite**

Run: `pnpm test:e2e`

Expected: PASS, with search/discover flows and missing-reader redirect still green after the reader changes.

- [ ] **Step 3: Run the backend verification for remote-book support**

Run: `cargo test && cargo check`

Expected: PASS.

- [ ] **Step 4: Commit the roadmap verification checkpoint**

```bash
git commit --allow-empty -m "chore: verify reader roadmap checkpoint"
```
