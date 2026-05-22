import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { useBookStore } from "@/stores/bookStore";

const mockInvoke = vi.mocked(invoke);

describe("bookStore reader entry support", () => {
  beforeEach(() => {
    useBookStore.setState({ books: [], loading: false, loaded: false, viewMode: "grid" });
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
