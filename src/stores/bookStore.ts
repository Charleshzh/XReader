import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { BookItem, ImportResult, ViewMode } from "@/types/book";

interface BookState {
  books: BookItem[];
  loading: boolean;
  loaded: boolean;
  viewMode: ViewMode;

  /** Fetch books from Rust backend */
  loadBooks: () => Promise<void>;

  /** Import a book by file path */
  importBook: (filePath: string) => Promise<ImportResult>;

  /** Delete a book */
  deleteBook: (id: string) => Promise<void>;

  /** Toggle grid/list view */
  setViewMode: (mode: ViewMode) => void;

  /** Add a remote book from a source result */
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

  importBook: async (filePath: string) => {
    const result = await invoke<ImportResult>("import_book", { filePath });
    await get().loadBooks();
    return result;
  },

  deleteBook: async (id: string) => {
    await invoke("delete_book", { id });
    await get().loadBooks();
  },

  setViewMode: (mode: ViewMode) => set({ viewMode: mode }),

  addRemoteBook: async (sourceId: string, bookUrl: string) => {
    const result = await invoke<ImportResult>("add_remote_book", { sourceId, bookUrl });
    await get().loadBooks();
    return result;
  },
}));
