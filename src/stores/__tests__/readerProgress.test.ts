import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import type { BookItem } from "@/types/book";
import { cloneReaderSettingsState, DEFAULT_READER_SETTINGS_STATE } from "@/types/reader";
import { createInitialReaderRuntimeState, useReaderStore } from "@/stores/readerStore";

const mockInvoke = vi.mocked(invoke);
const book: BookItem = {
  id: "b1",
  title: "测试书",
  author: "作者",
  cover_path: "",
  format: "epub",
  file_path: "demo.epub",
  total_chapters: 3,
  updated_at: 1,
  source_type: "local",
  source_id: "",
  source_url: "",
};

describe("reader progress and bookmark position", () => {
  beforeEach(() => {
    const initial = createInitialReaderRuntimeState();
    const settingsState = cloneReaderSettingsState(DEFAULT_READER_SETTINGS_STATE);
    useReaderStore.setState({
      ...initial,
      book,
      chapters: [{ index: 0, title: "第一章" }],
      settingsState,
      activeStyle: settingsState.styles[0],
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
    mockInvoke.mockResolvedValueOnce(undefined).mockResolvedValueOnce([]);

    await useReaderStore.getState().addBookmark("进度点");

    expect(mockInvoke).toHaveBeenCalledWith("add_bookmark", {
      bookId: "b1",
      chapterIndex: 0,
      position: 0.42,
      label: "进度点",
    });
  });
});
