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
      .mockResolvedValueOnce({
        id: "remote-1",
        title: "远程书",
        author: "作者",
        cover_path: "",
        format: "remote",
        total_chapters: 12,
        message: "ok",
      })
      .mockResolvedValueOnce([
        {
          id: "remote-1",
          title: "远程书",
          author: "作者",
          cover_path: "",
          format: "remote",
          file_path: "",
          total_chapters: 12,
          updated_at: 1,
          source_type: "remote",
          source_id: "src-1",
          source_url: "https://example.com/book",
        },
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
