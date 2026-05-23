import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import type { BookItem } from "@/types/book";
import { cloneReaderSettingsState, DEFAULT_READER_SETTINGS_STATE } from "@/types/reader";
import { createInitialReaderRuntimeState, useReaderStore } from "@/stores/readerStore";

const mockInvoke = vi.mocked(invoke);
const book: BookItem = {
  id: "book-1",
  title: "测试书",
  author: "作者",
  cover_path: "",
  format: "epub",
  file_path: "test.epub",
  total_chapters: 2,
  updated_at: 1,
  source_type: "local",
  source_id: "",
  source_url: "",
};

describe("useReaderStore", () => {
  beforeEach(() => {
    const initial = createInitialReaderRuntimeState();
    useReaderStore.setState({
      ...initial,
      settingsState: cloneReaderSettingsState(DEFAULT_READER_SETTINGS_STATE),
      activeStyle: cloneReaderSettingsState(DEFAULT_READER_SETTINGS_STATE).styles[0],
    });
    mockInvoke.mockReset();
  });

  it("opens a book and loads chapters and content", async () => {
    mockInvoke
      .mockResolvedValueOnce([
        { index: 0, title: "第一章" },
        { index: 1, title: "第二章" },
      ])
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
