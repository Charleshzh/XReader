import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { BookItem } from "@/types/book";
import type { ChapterInfo, ReaderSettings } from "@/types/reader";
import { DEFAULT_SETTINGS } from "@/types/reader";

interface ReaderState {
  /** Current book being read */
  book: BookItem | null;

  /** Chapter list */
  chapters: ChapterInfo[];

  /** Current chapter index */
  currentChapter: number;

  /** HTML content of current chapter */
  content: string;

  /** Loading state */
  loading: boolean;

  /** Reader settings */
  settings: ReaderSettings;

  /** TOC sidebar open */
  tocOpen: boolean;

  /** Settings panel open */
  settingsOpen: boolean;

  /** Load a book into the reader */
  openBook: (book: BookItem) => Promise<void>;

  /** Load a specific chapter */
  loadChapter: (index: number) => Promise<void>;

  /** Navigate to next/prev chapter */
  nextChapter: () => Promise<void>;
  prevChapter: () => Promise<void>;

  /** Save reading progress */
  saveProgress: (chapterIndex: number, position: number) => Promise<void>;

  /** Update reader settings */
  updateSettings: (partial: Partial<ReaderSettings>) => void;

  /** Toggle panels */
  toggleToc: () => void;
  toggleSettings: () => void;
}

export const useReaderStore = create<ReaderState>((set, get) => ({
  book: null,
  chapters: [],
  currentChapter: 0,
  content: "",
  loading: false,
  settings: DEFAULT_SETTINGS,
  tocOpen: false,
  settingsOpen: false,

  openBook: async (book) => {
    set({ book, loading: true, currentChapter: 0 });
    try {
      // Load chapters from Tauri backend
      const chaptersRaw = await invoke<{ index: number; title: string }[]>(
        "get_chapters",
        { bookId: book.id },
      );
      const chapters: ChapterInfo[] = chaptersRaw.map((c) => ({
        index: c.index,
        title: c.title || `第${c.index + 1}章`,
      }));
      set({ chapters });

      // Load first chapter
      const content = await invoke<string>("get_chapter_content", {
        bookId: book.id,
        chapterIndex: 0,
      });
      set({ content, loading: false });
    } catch (err) {
      console.error("Failed to open book:", err);
      set({ loading: false });
    }
  },

  loadChapter: async (index) => {
    const { book } = get();
    if (!book) return;
    set({ loading: true, currentChapter: index });
    try {
      const content = await invoke<string>("get_chapter_content", {
        bookId: book.id,
        chapterIndex: index,
      });
      set({ content, loading: false });
    } catch (err) {
      console.error("Failed to load chapter:", err);
      set({ loading: false });
    }
  },

  nextChapter: async () => {
    const { currentChapter, chapters } = get();
    if (currentChapter < chapters.length - 1) {
      await get().loadChapter(currentChapter + 1);
    }
  },

  prevChapter: async () => {
    const { currentChapter } = get();
    if (currentChapter > 0) {
      await get().loadChapter(currentChapter - 1);
    }
  },

  saveProgress: async (chapterIndex, position) => {
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

  updateSettings: (partial) => {
    set((s) => ({ settings: { ...s.settings, ...partial } }));
  },

  toggleToc: () => set((s) => ({ tocOpen: !s.tocOpen, settingsOpen: false })),
  toggleSettings: () =>
    set((s) => ({ settingsOpen: !s.settingsOpen, tocOpen: false })),
}));
