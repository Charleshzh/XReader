import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { BookItem } from "@/types/book";
import type { ChapterInfo, ReaderSettings } from "@/types/reader";
import { DEFAULT_SETTINGS } from "@/types/reader";

export interface BookmarkItem {
  id: string;
  book_id: string;
  chapter_index: number;
  position: number;
  label: string;
  created_at: number;
}

export interface AnnotationItem {
  id: string;
  book_id: string;
  chapter_index: number;
  start_position: number;
  end_position: number;
  text: string;
  note: string;
  color: string;
  created_at: number;
  updated_at: number;
}

export interface StatsSummary {
  total_seconds: number;
  total_words: number;
  daily: { date: string; read_seconds: number; read_words: number }[];
}

interface ReaderState {
  book: BookItem | null;
  chapters: ChapterInfo[];
  currentChapter: number;
  content: string;
  loading: boolean;
  settings: ReaderSettings;
  tocOpen: boolean;
  settingsOpen: boolean;

  // Bookmarks
  bookmarks: BookmarkItem[];
  bookmarksOpen: boolean;

  // Annotations
  annotations: AnnotationItem[];
  annotationsOpen: boolean;
  selectedAnnotation: AnnotationItem | null;

  // Reading session
  sessionSeconds: number;
  sessionWords: number;
  isReading: boolean;

  openBook: (book: BookItem) => Promise<void>;
  loadChapter: (index: number) => Promise<void>;
  nextChapter: () => Promise<void>;
  prevChapter: () => Promise<void>;
  saveProgress: (chapterIndex: number, position: number) => Promise<void>;
  updateSettings: (partial: Partial<ReaderSettings>) => void;
  toggleToc: () => void;
  toggleSettings: () => void;

  // Bookmark actions
  addBookmark: (label: string) => Promise<void>;
  loadBookmarks: () => Promise<void>;
  deleteBookmark: (id: string) => Promise<void>;
  toggleBookmarks: () => void;

  // Annotation actions
  addAnnotation: (
    text: string,
    note: string,
    color: string,
    start: number,
    end: number,
  ) => Promise<void>;
  loadAnnotations: () => Promise<void>;
  updateAnnotationNote: (id: string, note: string) => Promise<void>;
  deleteAnnotation: (id: string) => Promise<void>;
  selectAnnotation: (a: AnnotationItem | null) => void;
  toggleAnnotations: () => void;

  // Session
  startSession: () => void;
  endSession: () => Promise<void>;
  addWords: (words: number) => void;

  // Stats
  getStats: (days: number) => Promise<StatsSummary>;
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
  bookmarks: [],
  bookmarksOpen: false,
  annotations: [],
  annotationsOpen: false,
  selectedAnnotation: null,
  sessionSeconds: 0,
  sessionWords: 0,
  isReading: false,

  openBook: async (book) => {
    set({ book, loading: true, currentChapter: 0, bookmarks: [], annotations: [] });
    try {
      const chaptersRaw = await invoke<{ index: number; title: string }[]>("get_chapters", {
        bookId: book.id,
      });
      const chapters: ChapterInfo[] = chaptersRaw.map((c) => ({
        index: c.index,
        title: c.title || `第${c.index + 1}章`,
      }));
      const content = await invoke<string>("get_chapter_content", {
        bookId: book.id,
        chapterIndex: 0,
      });
      set({ chapters, content, loading: false });
      get().loadBookmarks();
      get().loadAnnotations();
      get().startSession();
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
      get().loadAnnotations();

      // Prefetch adjacent chapters
      const currentBook = get().book;
      if (currentBook) {
        prefetchChapter(currentBook.id, index + 1);
        prefetchChapter(currentBook.id, index - 1);
      }
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

  updateSettings: (partial) => set((s) => ({ settings: { ...s.settings, ...partial } })),
  toggleToc: () =>
    set((s) => ({
      tocOpen: !s.tocOpen,
      settingsOpen: false,
      bookmarksOpen: false,
      annotationsOpen: false,
    })),
  toggleSettings: () =>
    set((s) => ({
      settingsOpen: !s.settingsOpen,
      tocOpen: false,
      bookmarksOpen: false,
      annotationsOpen: false,
    })),

  // ── Bookmarks ──
  addBookmark: async (label) => {
    const { book, currentChapter } = get();
    if (!book) return;
    try {
      await invoke("add_bookmark", {
        bookId: book.id,
        chapterIndex: currentChapter,
        position: 0,
        label,
      });
      await get().loadBookmarks();
    } catch (err) {
      console.error("Failed to add bookmark:", err);
    }
  },
  loadBookmarks: async () => {
    const { book } = get();
    if (!book) return;
    try {
      const items = await invoke<BookmarkItem[]>("list_bookmarks", { bookId: book.id });
      set({ bookmarks: items });
    } catch (err) {
      console.error("Failed to load bookmarks:", err);
    }
  },
  deleteBookmark: async (id) => {
    await invoke("delete_bookmark", { id });
    await get().loadBookmarks();
  },
  toggleBookmarks: () =>
    set((s) => ({
      bookmarksOpen: !s.bookmarksOpen,
      tocOpen: false,
      settingsOpen: false,
      annotationsOpen: false,
    })),

  // ── Annotations ──
  addAnnotation: async (text, note, color, start, end) => {
    const { book, currentChapter } = get();
    if (!book) return;
    try {
      await invoke("add_annotation", {
        bookId: book.id,
        chapterIndex: currentChapter,
        startPosition: start,
        endPosition: end,
        text,
        note,
        color,
      });
      await get().loadAnnotations();
    } catch (err) {
      console.error("Failed to add annotation:", err);
    }
  },
  loadAnnotations: async () => {
    const { book, currentChapter } = get();
    if (!book) return;
    try {
      const items = await invoke<AnnotationItem[]>("list_annotations", {
        bookId: book.id,
        chapterIndex: currentChapter,
      });
      set({ annotations: items });
    } catch (err) {
      console.error("Failed to load annotations:", err);
    }
  },
  updateAnnotationNote: async (id, note) => {
    await invoke("update_annotation_note", { id, note });
    await get().loadAnnotations();
  },
  deleteAnnotation: async (id) => {
    await invoke("delete_annotation", { id });
    await get().loadAnnotations();
  },
  selectAnnotation: (a) => set({ selectedAnnotation: a }),
  toggleAnnotations: () =>
    set((s) => ({
      annotationsOpen: !s.annotationsOpen,
      tocOpen: false,
      settingsOpen: false,
      bookmarksOpen: false,
    })),

  // ── Session ──
  startSession: () => {
    set({ isReading: true, sessionSeconds: 0, sessionWords: 0 });
  },
  endSession: async () => {
    const { book, isReading, sessionSeconds, sessionWords } = get();
    if (!isReading || !book) return;
    set({ isReading: false });
    const today = new Date().toISOString().slice(0, 10);
    try {
      await invoke("log_reading_session", {
        bookId: book.id,
        date: today,
        seconds: sessionSeconds,
        words: sessionWords,
      });
    } catch (err) {
      console.error("Failed to log session:", err);
    }
  },
  addWords: (words) => set((s) => ({ sessionWords: s.sessionWords + words })),

  // ── Stats ──
  getStats: async (days) => {
    return await invoke<StatsSummary>("get_reading_stats", { days });
  },

  // (prefetchChapter is a module-level helper, not in the store)
}));

/** Prefetch a chapter in the background (fire-and-forget). */
function prefetchChapter(bookId: string, chapterIndex: number) {
  if (chapterIndex < 0) return;
  invoke<string>("get_chapter_content", { bookId, chapterIndex })
    .then(() => { /* cached by Rust/Tauri */ })
    .catch(() => { /* best-effort */ });
}
