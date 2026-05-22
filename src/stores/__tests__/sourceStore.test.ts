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
      {
        name: "雪中悍刀行",
        author: "烽火戏诸侯",
        cover_url: "",
        intro: "",
        book_url: "https://example.com/book",
      },
    ]);

    await useSourceStore.getState().searchBooks("s1", "雪中");

    expect(useSourceStore.getState().searchResults).toHaveLength(1);
    expect(useSourceStore.getState().searching).toBe(false);
  });
});
