# XReader Engineering Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a trustworthy engineering baseline for XReader by completing the highest-value automated tests, fixing documentation drift, and aligning CI with the repository’s actual verification surface.

**Architecture:** Add a thin frontend unit-test layer with Vitest + Testing Library, harden Playwright smoke tests into route-behavior tests, and extend Rust module coverage around command validation, sync config handling, and book-format behavior. Keep the testing surface boring: pure helper extraction where needed, direct store tests with mocked Tauri IPC, and inline Rust `#[cfg(test)]` modules for backend behavior. Reduce future docs drift by assigning each current-state fact to a small number of owner documents.

**Tech Stack:** React 19, TypeScript 5.8, Vitest, Testing Library, Playwright, Tauri v2, Rust `#[cfg(test)]`, GitHub Actions.

---

## File Map

### Frontend verification surface
- `package.json` — add frontend test scripts and dev dependencies
- `vitest.config.ts` — frontend unit-test runner config
- `src/test-setup.ts` — jsdom + jest-dom + shared Tauri IPC mock wiring
- `src/components/ErrorBoundary.tsx` — stable UI error-boundary behavior
- `src/components/reader/HtmlContentView.tsx` — highlight rendering and progress save behavior
- `src/lib/highlight.ts` — extracted pure highlight helper for deterministic tests
- `src/stores/bookStore.ts` — bookshelf domain store
- `src/stores/readerStore.ts` — reader domain store
- `src/stores/sourceStore.ts` — source/discover/search store
- `tests/e2e/smoke.spec.ts` — current route smoke suite to harden
- `playwright.config.ts` — smoke-runner behavior

### Backend verification surface
- `src-tauri/Cargo.toml` — Rust test-only dependencies where runtime fixture generation is required
- `src-tauri/src/commands.rs` — command validation helpers + tests
- `src-tauri/src/book/txt.rs` — TXT parser tests
- `src-tauri/src/book/epub.rs` — EPUB runtime-generated fixture tests
- `src-tauri/src/book/pdf.rs` — current placeholder PDF behavior tests
- `src-tauri/src/sync/mod.rs` — merge/export coverage extension

### Docs drift cleanup surface
- `README.md` — current outward-facing status and verification counts
- `CLAUDE.md` — current engineering reference
- `docs/gap-analysis.md` — current gap snapshot
- `docs/USAGE.md` — current user-facing install/usage claims
- `docs/phase-1-completion.md`
- `docs/phase-2-completion.md`
- `docs/phase-3-completion.md`
- `docs/phase-4-completion.md`
- `docs/phase-5-completion.md`
- `docs/phase-7-completion.md` — historical snapshots only
- `.github/workflows/ci.yml` — wire frontend unit tests into CI and stop overstating coverage

---

### Task 1: Add frontend unit-test infrastructure

**Files:**
- Create: `vitest.config.ts`
- Create: `src/test-setup.ts`
- Modify: `package.json`
- Modify: `tsconfig.json`
- Test: `src/components/__tests__/ErrorBoundary.test.tsx`

- [ ] **Step 1: Write the failing sentinel test**

```tsx
// src/components/__tests__/ErrorBoundary.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "@/components/ErrorBoundary";

function Boom() {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  it("renders a fallback and resets back to children", async () => {
    const user = userEvent.setup();
    const Recoverable = ({ crash }: { crash: boolean }) =>
      crash ? <Boom /> : <div>reader ok</div>;

    const { rerender } = render(
      <ErrorBoundary>
        <Recoverable crash={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("reader ok")).toBeInTheDocument();

    rerender(
      <ErrorBoundary>
        <Recoverable crash />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("heading", { name: "出错了" })).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "重试" }));

    rerender(
      <ErrorBoundary>
        <Recoverable crash={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("reader ok")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/components/__tests__/ErrorBoundary.test.tsx`

Expected: FAIL because Vitest and the jsdom test environment are not configured yet.

- [ ] **Step 3: Add the test runner, setup file, and scripts**

```json
// package.json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "lint": "eslint .",
    "format": "prettier --write \"src/**/*.{ts,tsx,css}\"",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "@vitest/coverage-v8": "^3.2.4",
    "jsdom": "^26.1.0",
    "vitest": "^3.2.4"
  }
}
```

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
```

```ts
// src/test-setup.ts
import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

Run once: `pnpm add -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom`

- [ ] **Step 4: Run the sentinel test and make sure it passes**

Run: `pnpm exec vitest run src/components/__tests__/ErrorBoundary.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts src/test-setup.ts src/components/__tests__/ErrorBoundary.test.tsx
git commit -m "test: add frontend unit test harness"
```

### Task 2: Extract and test the HTML highlight helper

**Files:**
- Create: `src/lib/highlight.ts`
- Create: `src/lib/highlight.test.ts`
- Modify: `src/components/reader/HtmlContentView.tsx`
- Test: `src/lib/highlight.test.ts`

- [ ] **Step 1: Write the failing helper tests**

```ts
// src/lib/highlight.test.ts
import { describe, expect, it } from "vitest";
import { highlightAnnotations, type HighlightAnnotation } from "@/lib/highlight";

const ann = (text: string, color = "yellow"): HighlightAnnotation => ({ text, color });

describe("highlightAnnotations", () => {
  it("returns the original html when there are no annotations", () => {
    expect(highlightAnnotations("<p>正文</p>", [])).toBe("<p>正文</p>");
  });

  it("wraps a single annotation in a <mark>", () => {
    const html = highlightAnnotations("<p>测试正文</p>", [ann("测试")]);
    expect(html).toContain("<mark");
    expect(html).toContain("测试");
    expect(html).toContain("bg-yellow-200");
  });

  it("skips empty annotation text", () => {
    expect(highlightAnnotations("<p>正文</p>", [ann("   ")])).toBe("<p>正文</p>");
  });

  it("avoids overlapping spans", () => {
    const html = highlightAnnotations("<p>测试测试</p>", [ann("测试测试", "pink"), ann("测试", "blue")]);
    expect((html.match(/<mark/g) ?? []).length).toBe(1);
  });

  it("falls back to yellow for unknown colors", () => {
    const html = highlightAnnotations("<p>正文</p>", [{ text: "正文", color: "purple" }]);
    expect(html).toContain("bg-yellow-200");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/highlight.test.ts`

Expected: FAIL because `@/lib/highlight` does not exist yet.

- [ ] **Step 3: Extract the pure helper and rewire the component**

```ts
// src/lib/highlight.ts
export interface HighlightAnnotation {
  text: string;
  color: string;
}

const COLOR_MAP: Record<string, string> = {
  yellow: "bg-yellow-200 dark:bg-yellow-800",
  green: "bg-green-200 dark:bg-green-800",
  blue: "bg-blue-200 dark:bg-blue-800",
  pink: "bg-pink-200 dark:bg-pink-800",
  orange: "bg-orange-200 dark:bg-orange-800",
};

export function highlightAnnotations(html: string, annotations: HighlightAnnotation[]): string {
  if (annotations.length === 0) return html;

  const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "");
  const plainText = stripHtml(html);

  interface Span {
    start: number;
    end: number;
    color: string;
  }

  const spans: Span[] = [];

  for (const ann of annotations) {
    if (!ann.text.trim()) continue;
    let idx = 0;
    while (idx < plainText.length) {
      const found = plainText.indexOf(ann.text, idx);
      if (found === -1) break;

      const overlap = spans.some((span) => found < span.end && found + ann.text.length > span.start);
      if (!overlap) {
        spans.push({
          start: found,
          end: found + ann.text.length,
          color: ann.color,
        });
      }

      idx = found + ann.text.length;
    }
  }

  if (spans.length === 0) return html;
  spans.sort((a, b) => a.start - b.start);

  let result = "";
  let htmlPos = 0;
  let plainPos = 0;

  for (const span of spans) {
    while (plainPos < span.start && htmlPos < html.length) {
      const ch = html[htmlPos];
      result += ch;
      htmlPos++;
      if (ch === "<") {
        while (htmlPos < html.length && html[htmlPos] !== ">") {
          result += html[htmlPos++];
        }
        if (htmlPos < html.length) result += html[htmlPos++];
      } else {
        plainPos++;
      }
    }

    const colorClass = COLOR_MAP[span.color] || COLOR_MAP.yellow;
    result += `<mark class="${colorClass} bg-opacity-40 dark:bg-opacity-40 rounded-sm">`;

    let spanPlain = 0;
    while (spanPlain < span.end - span.start && htmlPos < html.length) {
      const ch = html[htmlPos];
      result += ch;
      htmlPos++;
      if (ch === "<") {
        while (htmlPos < html.length && html[htmlPos] !== ">") {
          result += html[htmlPos++];
        }
        if (htmlPos < html.length) result += html[htmlPos++];
      } else {
        plainPos++;
        spanPlain++;
      }
    }

    result += "</mark>";
  }

  return result + html.slice(htmlPos);
}
```

```tsx
// src/components/reader/HtmlContentView.tsx
import { useRef, useEffect, useCallback, useMemo } from "react";
import { useReaderStore } from "@/stores/readerStore";
import { highlightAnnotations } from "@/lib/highlight";

interface HtmlContentViewProps {
  content: string;
}
```

- [ ] **Step 4: Run the helper test suite**

Run: `pnpm exec vitest run src/lib/highlight.test.ts src/components/__tests__/ErrorBoundary.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/highlight.ts src/lib/highlight.test.ts src/components/reader/HtmlContentView.tsx
git commit -m "test: cover reader highlight helper"
```

### Task 3: Add Zustand store tests for bookshelf, reader, and source flows

**Files:**
- Create: `src/stores/__tests__/bookStore.test.ts`
- Create: `src/stores/__tests__/readerStore.test.ts`
- Create: `src/stores/__tests__/sourceStore.test.ts`
- Modify: `src/stores/bookStore.ts` (only if a tiny helper extraction is required)
- Modify: `src/stores/readerStore.ts` (only if a tiny helper extraction is required)
- Modify: `src/stores/sourceStore.ts` (only if a tiny helper extraction is required)
- Test: `src/stores/__tests__/bookStore.test.ts`
- Test: `src/stores/__tests__/readerStore.test.ts`
- Test: `src/stores/__tests__/sourceStore.test.ts`

- [ ] **Step 1: Write the failing store tests**

```ts
// src/stores/__tests__/bookStore.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { useBookStore } from "@/stores/bookStore";

const mockInvoke = vi.mocked(invoke);

describe("useBookStore", () => {
  beforeEach(() => {
    useBookStore.setState({ books: [], loading: false, viewMode: "grid" });
    mockInvoke.mockReset();
  });

  it("loads books from the backend", async () => {
    mockInvoke.mockResolvedValueOnce([
      { id: "1", title: "三体", author: "刘慈欣", cover_path: "", format: "epub", file_path: "a.epub", total_chapters: 10, updated_at: 1 },
    ]);

    await useBookStore.getState().loadBooks();

    expect(useBookStore.getState().books).toHaveLength(1);
    expect(useBookStore.getState().loading).toBe(false);
    expect(mockInvoke).toHaveBeenCalledWith("list_books");
  });

  it("refreshes after import", async () => {
    mockInvoke
      .mockResolvedValueOnce({ id: "1", title: "导入", author: "", cover_path: "", format: "txt", total_chapters: 1, message: "ok" })
      .mockResolvedValueOnce([{ id: "1", title: "导入", author: "", cover_path: "", format: "txt", file_path: "a.txt", total_chapters: 1, updated_at: 1 }]);

    await useBookStore.getState().importBook("a.txt");

    expect(useBookStore.getState().books[0]?.title).toBe("导入");
  });
});
```

```ts
// src/stores/__tests__/readerStore.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { useReaderStore } from "@/stores/readerStore";

const mockInvoke = vi.mocked(invoke);
const book = {
  id: "book-1",
  title: "测试书",
  author: "作者",
  cover_path: "",
  format: "epub",
  file_path: "test.epub",
  total_chapters: 2,
  updated_at: 1,
};

describe("useReaderStore", () => {
  beforeEach(() => {
    useReaderStore.setState({
      book: null,
      chapters: [],
      currentChapter: 0,
      content: "",
      loading: false,
      settings: useReaderStore.getState().settings,
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
    });
    mockInvoke.mockReset();
  });

  it("opens a book and loads chapters and content", async () => {
    mockInvoke
      .mockResolvedValueOnce([{ index: 0, title: "第一章" }, { index: 1, title: "第二章" }])
      .mockResolvedValueOnce("<p>正文</p>")
      .mockResolvedValueOnce("")
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await useReaderStore.getState().openBook(book);

    expect(useReaderStore.getState().book?.id).toBe("book-1");
    expect(useReaderStore.getState().chapters).toHaveLength(2);
    expect(useReaderStore.getState().content).toContain("正文");
    expect(useReaderStore.getState().isReading).toBe(true);
  });

  it("keeps panel toggles mutually exclusive", () => {
    useReaderStore.getState().toggleToc();
    expect(useReaderStore.getState().tocOpen).toBe(true);

    useReaderStore.getState().toggleSettings();
    expect(useReaderStore.getState().settingsOpen).toBe(true);
    expect(useReaderStore.getState().tocOpen).toBe(false);
  });
});
```

```ts
// src/stores/__tests__/sourceStore.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { useSourceStore } from "@/stores/sourceStore";

const mockInvoke = vi.mocked(invoke);

describe("useSourceStore", () => {
  beforeEach(() => {
    useSourceStore.setState({ sources: [], loading: false, searchResults: [], searching: false });
    mockInvoke.mockReset();
  });

  it("loads sources", async () => {
    mockInvoke.mockResolvedValueOnce([
      { id: "s1", name: "起点", base_url: "https://example.com", enabled: true, created_at: 1 },
    ]);

    await useSourceStore.getState().loadSources();

    expect(useSourceStore.getState().sources).toHaveLength(1);
  });

  it("stores search results and clears searching", async () => {
    mockInvoke.mockResolvedValueOnce([
      { name: "雪中悍刀行", author: "烽火戏诸侯", cover_url: "", intro: "", book_url: "https://example.com/book" },
    ]);

    await useSourceStore.getState().searchBooks("s1", "雪中");

    expect(useSourceStore.getState().searchResults).toHaveLength(1);
    expect(useSourceStore.getState().searching).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/stores/__tests__/bookStore.test.ts src/stores/__tests__/readerStore.test.ts src/stores/__tests__/sourceStore.test.ts`

Expected: FAIL on state-shape reset mistakes or missing mocks until the tests and any tiny helper extractions are corrected.

- [ ] **Step 3: Make the stores test-friendly without changing behavior**

```ts
// If the reset shape becomes too fragile, add tiny exported initial-state helpers.
// src/stores/bookStore.ts
export const initialBookState = {
  books: [],
  loading: false,
  viewMode: "grid" as const,
};
```

```ts
// src/stores/sourceStore.ts
export const initialSourceState = {
  sources: [],
  loading: false,
  searchResults: [],
  searching: false,
};
```

```ts
// src/stores/readerStore.ts
export const initialReaderRuntimeState = {
  book: null,
  chapters: [],
  currentChapter: 0,
  content: "",
  loading: false,
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
};
```

Use these constants only to stabilize tests and reset logic; do not add new abstractions beyond that.

- [ ] **Step 4: Run the store suite and make it green**

Run: `pnpm exec vitest run src/stores/__tests__/bookStore.test.ts src/stores/__tests__/readerStore.test.ts src/stores/__tests__/sourceStore.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/bookStore.ts src/stores/sourceStore.ts src/stores/readerStore.ts src/stores/__tests__/bookStore.test.ts src/stores/__tests__/readerStore.test.ts src/stores/__tests__/sourceStore.test.ts
git commit -m "test: cover zustand stores"
```

### Task 4: Harden Playwright smoke into route-behavior tests

**Files:**
- Modify: `tests/e2e/smoke.spec.ts`
- Modify: `playwright.config.ts`
- Modify: `src/pages/BookshelfPage.tsx`
- Modify: `src/pages/SearchPage.tsx`
- Modify: `src/pages/SourceManagePage.tsx`
- Modify: `src/pages/DiscoverPage.tsx`
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/pages/StatsPage.tsx`
- Test: `tests/e2e/smoke.spec.ts`

- [ ] **Step 1: Rewrite the failing smoke expectations first**

```ts
// tests/e2e/smoke.spec.ts
import { test, expect } from "@playwright/test";

test.describe("XReader Smoke Tests", () => {
  test("bookshelf page renders header and toolbar", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "书架" })).toBeVisible();
    await expect(page.getByRole("button", { name: "打开阅读统计" })).toBeVisible();
    await expect(page.getByRole("button", { name: "打开搜索书籍" })).toBeVisible();
    await expect(page.getByRole("button", { name: "打开发现页" })).toBeVisible();
  });

  test("search page renders heading and search controls", async ({ page }) => {
    await page.goto("/search");
    await expect(page.getByRole("heading", { name: "搜索书籍" })).toBeVisible();
    await expect(page.getByPlaceholder("输入书名或作者...")).toBeVisible();
    await expect(page.getByRole("button", { name: "搜索" })).toBeVisible();
  });

  test("stats page renders summary cards", async ({ page }) => {
    await page.goto("/stats");
    await expect(page.getByRole("heading", { name: "阅读统计" })).toBeVisible();
    await expect(page.getByText("总阅读时长")).toBeVisible();
    await expect(page.getByText("总阅读字数")).toBeVisible();
  });

  test("reader with missing book redirects back to bookshelf", async ({ page }) => {
    await page.goto("/reader/nonexistent-id");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "书架" })).toBeVisible();
  });
});
```

- [ ] **Step 2: Run smoke to verify it fails**

Run: `pnpm exec playwright test tests/e2e/smoke.spec.ts`

Expected: FAIL because the toolbar icon buttons in `BookshelfPage` have no accessible names yet, and the current tests still suppress page errors.

- [ ] **Step 3: Add stable accessibility hooks and stop swallowing runtime errors**

```tsx
// src/pages/BookshelfPage.tsx
<Button variant="ghost" size="icon" aria-label="打开阅读统计" onClick={() => navigate("/stats")}>
  <BarChart3 className="h-4 w-4" />
</Button>
<Button variant="ghost" size="icon" aria-label="打开搜索书籍" onClick={() => navigate("/search")}>
  <Search className="h-4 w-4" />
</Button>
<Button variant="ghost" size="icon" aria-label="打开发现页" onClick={() => navigate("/discover")}>
  <Compass className="h-4 w-4" />
</Button>
<Button variant="ghost" size="icon" aria-label="打开书源管理" onClick={() => navigate("/sources")}>
  <Globe className="h-4 w-4" />
</Button>
<Button variant="ghost" size="icon" aria-label="打开设置" onClick={() => navigate("/settings")}>
  <Settings className="h-4 w-4" />
</Button>
```

```ts
// tests/e2e/smoke.spec.ts
// Delete this block entirely:
// test.beforeEach(async ({ page }) => {
//   page.on("pageerror", () => {});
// });
```

```ts
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  fullyParallel: true,
  use: {
    baseURL: "http://localhost:1420",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:1420",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
```

- [ ] **Step 4: Run smoke again and make it pass**

Run: `pnpm exec playwright test tests/e2e/smoke.spec.ts`

Expected: PASS with route-specific assertions and no swallowed `pageerror` events.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/smoke.spec.ts playwright.config.ts src/pages/BookshelfPage.tsx
git commit -m "test: harden smoke coverage"
```

### Task 5: Refactor backend command validation into pure helpers and test them

**Files:**
- Modify: `src-tauri/src/commands.rs`
- Test: `src-tauri/src/commands.rs`

- [ ] **Step 1: Write the failing command-helper tests**

```rust
// src-tauri/src/commands.rs (inside #[cfg(test)] mod tests)
#[test]
fn test_validate_import_path_rejects_missing_file() {
    let err = validate_import_path("missing-file.epub").unwrap_err();
    assert!(err.contains("File not found"));
}

#[test]
fn test_parse_sync_config_text_accepts_plaintext_fallback() {
    let json = r#"{"enabled":false,"backend_type":"webdav","url":"","username":"","password":"","auto_sync_interval_minutes":30}"#;
    let parsed = parse_sync_config_text(json).unwrap();
    assert_eq!(parsed, json);
}

#[test]
fn test_validate_export_target_rejects_large_payload() {
    let err = validate_export_target("C:/Users/test/Documents/out.md", MAX_EXPORT_SIZE + 1).unwrap_err();
    assert!(err.contains("Export content too large"));
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test test_validate_import_path_rejects_missing_file --quiet`

Expected: FAIL because the pure helpers do not exist yet.

- [ ] **Step 3: Extract pure helpers and call them from the Tauri commands**

```rust
// src-tauri/src/commands.rs
fn validate_import_path(file_path: &str) -> Result<std::path::PathBuf, String> {
    let path = std::path::PathBuf::from(file_path);
    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }
    Ok(path)
}

fn parse_sync_config_text(raw: &str) -> Result<String, String> {
    if raw.is_empty() {
        return Ok(String::new());
    }
    match crate::sync::crypto::decrypt(raw) {
        Ok(decrypted) => Ok(decrypted),
        Err(_) => Ok(raw.to_string()),
    }
}

fn validate_export_target(path: &str, content_len: usize) -> Result<std::path::PathBuf, String> {
    if content_len > MAX_EXPORT_SIZE {
        return Err(format!(
            "Export content too large: {} bytes (max {})",
            content_len,
            MAX_EXPORT_SIZE
        ));
    }

    let path_buf = std::path::Path::new(path).to_path_buf();
    let parent = path_buf
        .parent()
        .ok_or_else(|| "Invalid path: no parent directory".to_string())?;
    let filename = path_buf
        .file_name()
        .ok_or_else(|| "Invalid path: no filename".to_string())?
        .to_string_lossy()
        .to_string();

    let resolved_parent = std::fs::canonicalize(parent)
        .map_err(|e| format!("Cannot access directory: {}", e))?;

    let allowed_str = resolved_parent.to_string_lossy().to_lowercase();
    let is_allowed = allowed_str.contains("\\documents")
        || allowed_str.contains("/documents")
        || allowed_str.contains("\\downloads")
        || allowed_str.contains("/downloads")
        || allowed_str.contains("\\desktop")
        || allowed_str.contains("/desktop");

    if !is_allowed {
        return Err("Export path must be within Documents, Downloads, or Desktop".to_string());
    }

    Ok(resolved_parent.join(filename))
}
```

In `import_book`, replace the ad-hoc `PathBuf::from(&file_path)` + manual `exists()` branch with `let path = validate_import_path(&file_path)?;` before the registry lookup.

```rust
pub fn get_sync_config(state: State<AppState>) -> Result<serde_json::Value, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let encrypted = crate::db::queries::get_setting(&db, "sync_config")
        .map_err(|e| e.to_string())?
        .unwrap_or_default();
    if encrypted.is_empty() {
        return Ok(serde_json::Value::Null);
    }
    let decrypted = parse_sync_config_text(&encrypted)?;
    serde_json::from_str(&decrypted).map_err(|e| e.to_string())
}

pub fn write_file(state: State<AppState>, path: String, content: String) -> Result<(), String> {
    let resolved = validate_export_target(&path, content.len())?;
    std::fs::write(&resolved, content).map_err(|e| format!("Failed to write file: {}", e))
}
```

- [ ] **Step 4: Run the targeted Rust tests**

Run: `cargo test test_validate_import_path_rejects_missing_file --quiet`

Expected: PASS.

Then run: `cargo test test_parse_sync_config_text_accepts_plaintext_fallback --quiet`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands.rs
git commit -m "test: cover command validation helpers"
```

### Task 6: Extend Rust format and sync coverage with runtime-generated fixtures

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/book/txt.rs`
- Modify: `src-tauri/src/book/epub.rs`
- Modify: `src-tauri/src/book/pdf.rs`
- Modify: `src-tauri/src/sync/mod.rs`
- Test: `src-tauri/src/book/txt.rs`
- Test: `src-tauri/src/book/epub.rs`
- Test: `src-tauri/src/book/pdf.rs`
- Test: `src-tauri/src/sync/mod.rs`

- [ ] **Step 1: Add the failing tests first**

```rust
// src-tauri/src/book/pdf.rs
#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn test_pdf_format_uses_filename_as_title() {
        let format = PdfFormat;
        let meta = format.parse(Path::new("D:/Books/凡人修仙传.pdf")).unwrap();
        assert_eq!(meta.title, "凡人修仙传");
        assert_eq!(meta.format, "pdf");
        assert_eq!(meta.total_chapters, 1);
    }

    #[test]
    fn test_pdf_format_returns_single_placeholder_chapter() {
        let format = PdfFormat;
        let chapters = format.get_chapters(Path::new("D:/Books/demo.pdf")).unwrap();
        assert_eq!(chapters.len(), 1);
        assert_eq!(chapters[0].title, "正文");
    }
}
```

```rust
// src-tauri/src/book/epub.rs
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;
    use tempfile::tempdir;
    use zip::write::SimpleFileOptions;

    fn write_minimal_epub(path: &std::path::Path) {
        let file = File::create(path).unwrap();
        let mut zip = zip::ZipWriter::new(file);
        let stored = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
        let deflated = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

        zip.start_file("mimetype", stored).unwrap();
        zip.write_all(b"application/epub+zip").unwrap();

        zip.add_directory("META-INF/", deflated).unwrap();
        zip.start_file("META-INF/container.xml", deflated).unwrap();
        zip.write_all(br#"<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>"#).unwrap();

        zip.add_directory("OEBPS/", deflated).unwrap();
        zip.start_file("OEBPS/content.opf", deflated).unwrap();
        zip.write_all(br#"<?xml version="1.0" encoding="utf-8"?><package version="2.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>测试 EPUB</dc:title><dc:creator>测试作者</dc:creator></metadata><manifest><item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/></manifest><spine toc="ncx"><itemref idref="chapter1"/></spine></package>"#).unwrap();
        zip.start_file("OEBPS/chapter1.xhtml", deflated).unwrap();
        zip.write_all(br#"<html xmlns="http://www.w3.org/1999/xhtml"><body><p>第一章正文</p></body></html>"#).unwrap();

        zip.finish().unwrap();
    }

    #[test]
    fn test_parse_minimal_epub_metadata() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("minimal.epub");
        write_minimal_epub(&path);

        let meta = EpubFormat.parse(&path).unwrap();
        assert_eq!(meta.title, "测试 EPUB");
        assert_eq!(meta.author, "测试作者");
        assert_eq!(meta.total_chapters, 1);
    }

    #[test]
    fn test_invalid_epub_returns_error() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("broken.epub");
        std::fs::write(&path, b"not a zip").unwrap();

        let err = EpubFormat.parse(&path).unwrap_err().to_string();
        assert!(err.contains("Failed to parse EPUB") || err.contains("Cannot open EPUB"));
    }
}
```

```rust
// src-tauri/src/book/txt.rs
#[test]
fn test_split_chapters_falls_back_to_single_chapter() {
    let chapters = split_chapters("这是一整章没有标题的正文");
    assert_eq!(chapters.len(), 1);
    assert_eq!(chapters[0].title, "正文");
}

#[test]
fn test_detect_and_decode_prefers_valid_utf8() {
    let (decoded, encoding) = detect_and_decode("第一章 正文".as_bytes());
    assert_eq!(decoded, "第一章 正文");
    assert_eq!(encoding, "utf-8");
}
```

```rust
// src-tauri/src/sync/mod.rs
#[test]
fn test_apply_merge_updates_sync_meta_for_all_tables() {
    let db = test_db();
    let rows = vec![("books".to_string(), vec![json!({"id":"b1","title":"书","author":"","format":"txt","updated_at":1000})])];

    let (_uploaded, _downloaded) = SyncEngine::apply_merge(&db, &rows).unwrap();

    let count: i64 = db
        .query_row("SELECT COUNT(*) FROM sync_meta", [], |r| r.get(0))
        .unwrap();
    assert_eq!(count, SYNC_TABLES.len() as i64);
}
```

- [ ] **Step 2: Run the targeted Rust tests and confirm failure**

Run: `cargo test test_pdf_format_uses_filename_as_title --quiet`

Expected: FAIL because the new tests are not present yet.

- [ ] **Step 3: Add the Rust test-only dependencies and implementations**

```toml
# src-tauri/Cargo.toml
[dev-dependencies]
tempfile = "3.16.0"
zip = { version = "2.2.2", default-features = false, features = ["deflate"] }
```

Keep the runtime code boring; only the tests need generated EPUB fixtures.

- [ ] **Step 4: Run the targeted Rust test groups**

Run: `cargo test test_pdf_format_uses_filename_as_title --quiet`

Expected: PASS.

Run: `cargo test test_parse_minimal_epub_metadata --quiet`

Expected: PASS.

Run: `cargo test test_apply_merge_updates_sync_meta_for_all_tables --quiet`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/book/txt.rs src-tauri/src/book/epub.rs src-tauri/src/book/pdf.rs src-tauri/src/sync/mod.rs
git commit -m "test: extend rust format and sync coverage"
```

### Task 7: Clean documentation drift and wire the new verification into CI

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`
- Modify: `docs/gap-analysis.md`
- Modify: `docs/USAGE.md`
- Modify: `docs/phase-1-completion.md`
- Modify: `docs/phase-2-completion.md`
- Modify: `docs/phase-3-completion.md`
- Modify: `docs/phase-4-completion.md`
- Modify: `docs/phase-5-completion.md`
- Modify: `docs/phase-7-completion.md`
- Modify: `.github/workflows/ci.yml`
- Test: `.github/workflows/ci.yml`

- [ ] **Step 1: Update the stale docs with the actual verified counts and scope**

```md
<!-- README.md -->
**Status**: Beta-ready — 65/72 plan items (90%), 52 Rust tests (7 ignored), 6 Playwright smoke tests.
```

```md
<!-- README.md commands section -->
pnpm test             # Vitest frontend unit tests
pnpm test:e2e         # Playwright smoke tests (6 cases)
```

```md
<!-- CLAUDE.md quick commands -->
# Rust (in src-tauri/)
cargo check           # Type check
cargo test            # 52 pass, 7 ignored
cargo clippy -- -D warnings
cargo fmt --check
```

```md
<!-- docs/gap-analysis.md -->
**测试覆盖**：52 Rust 单元测试 + 6 Playwright smoke cases + Playwright CI。

| 层级 | 计划 | 实际 | 差距 |
| --- | --- | --- | --- |
| Rust 单元测试 | 所有模块 | source/sync/txt + 新增 commands/book 覆盖 | db 仍薄 |
| 前端组件测试 | Vitest + RTL | 新增 ErrorBoundary / helper / store tests | Reader UI 仍待补 |
| E2E 冒烟测试 | Playwright | 6 条关键路由 smoke | 仍不是完整桌面 E2E |
```

```md
<!-- docs/USAGE.md -->
### macOS / Linux
当前仓库 CI 已具备对应构建任务，但正式安装包是否对外发布以 Releases 页面为准。
```

```md
<!-- docs/phase-7-completion.md and other phase docs -->
> Historical snapshot: this document records the project state when Phase 7 was completed. For the current verified status, see `README.md`.
```

Also replace the placeholder Legado link in `docs/USAGE.md` with the actual repository URL.

- [ ] **Step 2: Run a docs drift check and verify current numbers are consistent**

Run: `pnpm test && pnpm test:e2e && cargo test`

Expected: PASS, and the numbers produced by those commands match the docs you just updated.

- [ ] **Step 3: Wire frontend tests into CI and make smoke coverage blocking**

```yaml
# .github/workflows/ci.yml
frontend:
  name: Frontend (lint + typecheck + unit tests)
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
      with: { version: 11 }
    - uses: actions/setup-node@v4
      with: { node-version: 22, cache: pnpm }
    - run: pnpm install --frozen-lockfile
    - run: pnpm tsc --noEmit
    - run: pnpm test
    - run: pnpm lint
    - run: npx prettier --check "src/**/*.{ts,tsx,css}"

e2e:
  name: E2E Smoke Test
  runs-on: ubuntu-latest
  continue-on-error: false
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
      with: { version: 11 }
    - uses: actions/setup-node@v4
      with: { node-version: 22, cache: pnpm }
    - run: pnpm install --frozen-lockfile
    - name: Install Playwright browsers
      run: pnpm exec playwright install chromium --with-deps
    - name: Run E2E tests (headless)
      run: pnpm exec playwright test
      env:
        CI: true
```

- [ ] **Step 4: Run the full verification sweep**

Run: `pnpm test && pnpm test:e2e && pnpm lint && pnpm build && cargo test && cargo check`

Expected: PASS. The docs now match the real suite size and the suite is enforced in CI.

- [ ] **Step 5: Commit**

```bash
git add README.md CLAUDE.md docs/gap-analysis.md docs/USAGE.md docs/phase-1-completion.md docs/phase-2-completion.md docs/phase-3-completion.md docs/phase-4-completion.md docs/phase-5-completion.md docs/phase-7-completion.md .github/workflows/ci.yml
git commit -m "docs: align verified status and ci coverage"
```

### Task 8: Final hardening verification

**Files:**
- Modify: none
- Test: repository verification commands only

- [ ] **Step 1: Run the final frontend verification**

Run: `pnpm test && pnpm test:e2e && pnpm lint && pnpm build`

Expected: PASS.

- [ ] **Step 2: Run the final backend verification**

Run: `cargo test && cargo check`

Expected: PASS.

- [ ] **Step 3: Sanity-check the current-state docs one last time**

Run: `python -c "from pathlib import Path; paths=[Path('README.md'), Path('CLAUDE.md'), Path('docs/gap-analysis.md')]; bad=[str(path) for path in paths if '9 E2E' in path.read_text(encoding='utf-8') or '39 pass, 8 ignored' in path.read_text(encoding='utf-8')]; assert not bad, bad; print('docs counts look current')"`

Expected: PASS with `docs counts look current`.

- [ ] **Step 4: Commit the final verification checkpoint**

```bash
git commit --allow-empty -m "chore: verify engineering hardening baseline"
```
