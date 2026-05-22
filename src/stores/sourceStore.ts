import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface SourceItem {
  id: string;
  name: string;
  base_url: string;
  enabled: boolean;
  created_at: number;
}

export interface SearchBookResult {
  name: string;
  author: string;
  cover_url: string;
  intro: string;
  book_url: string;
}

interface SourceState {
  sources: SourceItem[];
  loading: boolean;
  searchResults: SearchBookResult[];
  searching: boolean;

  loadSources: () => Promise<void>;
  importSource: (jsonStr: string) => Promise<void>;
  deleteSource: (id: string) => Promise<void>;
  searchBooks: (sourceId: string, keyword: string, page?: number) => Promise<void>;
}

export const useSourceStore = create<SourceState>((set, get) => ({
  sources: [],
  loading: false,
  searchResults: [],
  searching: false,

  loadSources: async () => {
    set({ loading: true });
    try {
      const sources = await invoke<SourceItem[]>("list_book_sources");
      set({ sources, loading: false });
    } catch (err) {
      console.error("Failed to load sources:", err);
      set({ loading: false });
    }
  },

  importSource: async (jsonStr: string) => {
    await invoke("import_book_source", { jsonStr });
    await get().loadSources();
  },

  deleteSource: async (id: string) => {
    await invoke("delete_book_source", { id });
    await get().loadSources();
  },

  searchBooks: async (sourceId: string, keyword: string, page = 1) => {
    set({ searching: true, searchResults: [] });
    try {
      const results = await invoke<SearchBookResult[]>("search_books", {
        sourceId,
        keyword,
        page,
      });
      set({ searchResults: results, searching: false });
    } catch (err) {
      console.error("Search failed:", err);
      set({ searching: false });
    }
  },
}));
