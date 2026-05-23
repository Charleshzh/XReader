import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { useBookStore } from "@/stores/bookStore";

const mockInvoke = vi.mocked(invoke);

describe("useBookStore", () => {
  beforeEach(() => {
    useBookStore.setState({ books: [], loading: false, loaded: false, viewMode: "grid" });
    mockInvoke.mockReset();
  });

  it("loads books from the backend", async () => {
    mockInvoke.mockResolvedValueOnce([
      {
        id: "1",
        title: "三体",
        author: "刘慈欣",
        cover_path: "",
        format: "epub",
        file_path: "a.epub",
        total_chapters: 10,
        updated_at: 1,
      },
    ]);

    await useBookStore.getState().loadBooks();

    expect(useBookStore.getState().books).toHaveLength(1);
    expect(useBookStore.getState().loading).toBe(false);
    expect(mockInvoke).toHaveBeenCalledWith("list_books");
  });

  it("refreshes after import", async () => {
    mockInvoke
      .mockResolvedValueOnce({
        id: "1",
        title: "导入",
        author: "",
        cover_path: "",
        format: "txt",
        total_chapters: 1,
        message: "ok",
      })
      .mockResolvedValueOnce([
        {
          id: "1",
          title: "导入",
          author: "",
          cover_path: "",
          format: "txt",
          file_path: "a.txt",
          total_chapters: 1,
          updated_at: 1,
        },
      ]);

    await useBookStore.getState().importBook("a.txt");

    expect(useBookStore.getState().books[0]?.title).toBe("导入");
  });
});
