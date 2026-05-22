import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { BookItem } from "@/types/book";
import type {
  AssistSettings,
  ChapterInfo,
  InteractionSettings,
  ReaderSettingsState,
  ReaderStylePreset,
  TapZone,
} from "@/types/reader";
import {
  DEFAULT_READER_SETTINGS_STATE,
  cloneReaderSettingsState,
  cloneReaderStylePreset,
} from "@/types/reader";
import { migrateReaderSettings } from "@/lib/migrateReaderSettings";

import { clampPageIndex, toChapterFraction } from "@/lib/paginatedLayout";

import type { ContentMatch } from "@/lib/contentSearch";

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

interface ReaderRuntimeState {
  book: BookItem | null;
  chapters: ChapterInfo[];
  currentChapter: number;
  currentPosition: number;
  currentPage: number;
  totalPages: number;
  content: string;
  loading: boolean;
  settingsState: ReaderSettingsState;
  activeStyle: ReaderStylePreset;
  tocOpen: boolean;
  settingsOpen: boolean;
  showSearchPanel: boolean;
  searchQuery: string;
  searchMatches: ContentMatch[];
  currentSearchIndex: number;
  bookmarks: BookmarkItem[];
  bookmarksOpen: boolean;
  annotations: AnnotationItem[];
  annotationsOpen: boolean;
  selectedAnnotation: AnnotationItem | null;
  sessionSeconds: number;
  sessionWords: number;
  isReading: boolean;
  ttsToggleToken: number;
}

interface ReaderState extends ReaderRuntimeState {
  openBook: (book: BookItem) => Promise<void>;
  loadChapter: (index: number, position?: number) => Promise<void>;
  nextChapter: () => Promise<void>;
  prevChapter: () => Promise<void>;
  saveProgress: (chapterIndex: number, position: number) => Promise<void>;
  setPageState: (page: number, totalPages: number) => void;
  nextPage: () => Promise<void>;
  prevPage: () => Promise<void>;
  updateSettingsState: (next: ReaderSettingsState) => void;
  replaceSettingsState: (next: ReaderSettingsState) => void;
  patchActiveStyle: (partial: Partial<ReaderStylePreset>) => void;
  selectStylePreset: (styleId: string) => void;
  createStylePreset: (name: string) => void;
  deleteStylePreset: (styleId: string) => void;
  patchInteraction: (partial: Partial<InteractionSettings>) => void;
  patchAssist: (partial: Partial<AssistSettings>) => void;
  dispatchTapAction: (zone: TapZone) => Promise<void>;
  toggleToc: () => void;
  toggleSettings: () => void;
  setSearchQuery: (query: string) => void;
  setSearchMatches: (matches: ContentMatch[]) => void;
  jumpToSearchMatch: (index: number) => void;
  closeSearchPanel: () => void;
  requestTtsToggle: () => void;
  loadSavedSettings: () => Promise<void>;
  addBookmark: (label: string) => Promise<void>;
  loadBookmarks: () => Promise<void>;
  deleteBookmark: (id: string) => Promise<void>;
  toggleBookmarks: () => void;
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
  startSession: () => void;
  endSession: () => Promise<void>;
  addWords: (words: number) => void;
  getStats: (days: number) => Promise<StatsSummary>;
}

function createSettingsState(): ReaderSettingsState {
  return cloneReaderSettingsState(DEFAULT_READER_SETTINGS_STATE);
}

function resolveActiveStyle(settingsState: ReaderSettingsState): ReaderStylePreset {
  return (
    settingsState.styles.find((style) => style.id === settingsState.activeStyleId) ??
    settingsState.styles[0]
  );
}

function persistSettingsState(settingsState: ReaderSettingsState) {
  void Promise.resolve(
    invoke("save_reader_settings", {
      settingsJson: JSON.stringify(settingsState),
    }),
  ).catch(() => {});
}

function setPersistedSettingsState(
  set: (partial: Partial<ReaderState> | ((state: ReaderState) => Partial<ReaderState>)) => void,
  next: ReaderSettingsState,
) {
  const normalized = migrateReaderSettings(next);
  const activeStyle = resolveActiveStyle(normalized);
  set({ settingsState: normalized, activeStyle });
  persistSettingsState(normalized);
}

function createStyleId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `style-${Date.now()}`;
}

export function createInitialReaderRuntimeState(): ReaderRuntimeState {
  const settingsState = createSettingsState();
  return {
    book: null,
    chapters: [],
    currentChapter: 0,
    currentPosition: 0,
    currentPage: 0,
    totalPages: 1,
    content: "",
    loading: false,
    settingsState,
    activeStyle: resolveActiveStyle(settingsState),
    tocOpen: false,
    settingsOpen: false,
    showSearchPanel: false,
    searchQuery: "",
    searchMatches: [],
    currentSearchIndex: 0,
    bookmarks: [],
    bookmarksOpen: false,
    annotations: [],
    annotationsOpen: false,
    selectedAnnotation: null,
    sessionSeconds: 0,
    sessionWords: 0,
    isReading: false,
    ttsToggleToken: 0,
  };
}

export const useReaderStore = create<ReaderState>((set, get) => ({
  ...createInitialReaderRuntimeState(),

  openBook: async (book) => {
    set({
      book,
      loading: true,
      currentChapter: 0,
      currentPosition: 0,
      currentPage: 0,
      totalPages: 1,
      showSearchPanel: false,
      searchQuery: "",
      searchMatches: [],
      currentSearchIndex: 0,
      bookmarks: [],
      annotations: [],
    });
    try {
      const chaptersRaw = await invoke<{ index: number; title: string }[]>("get_chapters", {
        bookId: book.id,
      });
      const chapters: ChapterInfo[] = chaptersRaw.map((chapter) => ({
        index: chapter.index,
        title: chapter.title || `第${chapter.index + 1}章`,
      }));
      const content = await invoke<string>("get_chapter_content", {
        bookId: book.id,
        chapterIndex: 0,
      });
      set({ chapters, content, loading: false });
      void get().loadSavedSettings();
      void get().loadBookmarks();
      void get().loadAnnotations();
      get().startSession();
    } catch (err) {
      console.error("Failed to open book:", err);
      set({ loading: false });
    }
  },

  loadChapter: async (index, position = 0) => {
    const { book } = get();
    if (!book) return;
    set({
      loading: true,
      currentChapter: index,
      currentPosition: position,
      currentPage: 0,
      totalPages: 1,
      searchMatches: [],
      currentSearchIndex: 0,
    });
    try {
      const content = await invoke<string>("get_chapter_content", {
        bookId: book.id,
        chapterIndex: index,
      });
      set({ content, loading: false });
      void get().loadAnnotations();

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
    set({ currentPosition: position });
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

  setPageState: (page, totalPages) => {
    const nextTotalPages = Math.max(1, totalPages);
    const nextPage = clampPageIndex(page, nextTotalPages);
    set({ currentPage: nextPage, totalPages: nextTotalPages });
    void get().saveProgress(get().currentChapter, toChapterFraction(nextPage, nextTotalPages));
  },

  nextPage: async () => {
    const { currentPage, totalPages, currentChapter, chapters } = get();
    if (currentPage + 1 < totalPages) {
      get().setPageState(currentPage + 1, totalPages);
      return;
    }
    if (currentChapter < chapters.length - 1) {
      await get().loadChapter(currentChapter + 1, 0);
    }
  },

  prevPage: async () => {
    const { currentPage, totalPages, currentChapter } = get();
    if (currentPage > 0) {
      get().setPageState(currentPage - 1, totalPages);
      return;
    }
    if (currentChapter > 0) {
      await get().loadChapter(currentChapter - 1, 1);
    }
  },

  updateSettingsState: (next) => {
    setPersistedSettingsState(set, next);
  },

  replaceSettingsState: (next) => {
    setPersistedSettingsState(set, next);
  },

  patchActiveStyle: (partial) => {
    const current = get().settingsState;
    const styles = current.styles.map((style) =>
      style.id === current.activeStyleId
        ? {
            ...cloneReaderStylePreset(style),
            ...partial,
            header: partial.header ? { ...style.header, ...partial.header } : { ...style.header },
            footer: partial.footer ? { ...style.footer, ...partial.footer } : { ...style.footer },
          }
        : cloneReaderStylePreset(style),
    );
    setPersistedSettingsState(set, { ...current, styles });
  },

  selectStylePreset: (styleId) => {
    const current = get().settingsState;
    if (!current.styles.some((style) => style.id === styleId)) {
      return;
    }
    setPersistedSettingsState(set, { ...current, activeStyleId: styleId });
  },

  createStylePreset: (name) => {
    const current = get().settingsState;
    const nextStyle: ReaderStylePreset = {
      ...cloneReaderStylePreset(get().activeStyle),
      id: createStyleId(),
      name: name.trim() || `样式 ${current.styles.length + 1}`,
    };
    setPersistedSettingsState(set, {
      ...current,
      activeStyleId: nextStyle.id,
      styles: [...current.styles.map(cloneReaderStylePreset), nextStyle],
    });
  },

  deleteStylePreset: (styleId) => {
    const current = get().settingsState;
    if (current.styles.length <= 1) {
      return;
    }

    const styles = current.styles.filter((style) => style.id !== styleId).map(cloneReaderStylePreset);
    if (styles.length === current.styles.length) {
      return;
    }

    setPersistedSettingsState(set, {
      ...current,
      activeStyleId:
        current.activeStyleId === styleId ? styles[0].id : current.activeStyleId,
      styles,
    });
  },

  patchInteraction: (partial) => {
    const current = get().settingsState;
    setPersistedSettingsState(set, {
      ...current,
      interaction: {
        ...current.interaction,
        ...partial,
      },
    });
  },

  patchAssist: (partial) => {
    const current = get().settingsState;
    setPersistedSettingsState(set, {
      ...current,
      assist: {
        ...current.assist,
        ...partial,
      },
    });
  },

  dispatchTapAction: async (zone) => {
    const action = get().settingsState.interaction.tapZones[zone];
    switch (action) {
      case "menu":
        get().toggleSettings();
        break;
      case "next-page":
        await get().nextPage();
        break;
      case "prev-page":
        await get().prevPage();
        break;
      case "next-chapter":
        await get().nextChapter();
        break;
      case "prev-chapter":
        await get().prevChapter();
        break;
      case "bookmark":
        await get().addBookmark("书签");
        break;
      case "search":
        set({ showSearchPanel: true });
        break;
      case "tts-toggle":
        get().requestTtsToggle();
        break;
      default:
        break;
    }
  },

  toggleToc: () =>
    set((state) => ({
      tocOpen: !state.tocOpen,
      settingsOpen: false,
      bookmarksOpen: false,
      annotationsOpen: false,
      showSearchPanel: false,
    })),

  toggleSettings: () =>
    set((state) => ({
      settingsOpen: !state.settingsOpen,
      tocOpen: false,
      bookmarksOpen: false,
      annotationsOpen: false,
      showSearchPanel: false,
    })),

  setSearchQuery: (query) =>
    set({
      searchQuery: query,
      currentSearchIndex: 0,
      showSearchPanel: true,
    }),

  setSearchMatches: (matches) =>
    set((state) => ({
      searchMatches: matches,
      currentSearchIndex:
        matches.length === 0
          ? 0
          : Math.max(0, Math.min(state.currentSearchIndex, matches.length - 1)),
    })),

  jumpToSearchMatch: (index) =>
    set((state) => ({
      currentSearchIndex:
        state.searchMatches.length === 0
          ? 0
          : Math.max(0, Math.min(index, state.searchMatches.length - 1)),
    })),

  closeSearchPanel: () => set({ showSearchPanel: false }),

  requestTtsToggle: () =>
    set((state) => ({
      ttsToggleToken: state.ttsToggleToken + 1,
    })),

  loadSavedSettings: async () => {
    try {
      const json = await invoke<string>("load_reader_settings");
      if (!json) return;
      const parsed = migrateReaderSettings(JSON.parse(json));
      set({ settingsState: parsed, activeStyle: resolveActiveStyle(parsed) });
    } catch {
      /* no saved settings yet */
    }
  },

  addBookmark: async (label) => {
    const { book, currentChapter, currentPosition } = get();
    if (!book) return;
    try {
      await invoke("add_bookmark", {
        bookId: book.id,
        chapterIndex: currentChapter,
        position: currentPosition,
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
    set((state) => ({
      bookmarksOpen: !state.bookmarksOpen,
      tocOpen: false,
      settingsOpen: false,
      annotationsOpen: false,
      showSearchPanel: false,
    })),

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

  selectAnnotation: (annotation) => set({ selectedAnnotation: annotation }),

  toggleAnnotations: () =>
    set((state) => ({
      annotationsOpen: !state.annotationsOpen,
      tocOpen: false,
      settingsOpen: false,
      bookmarksOpen: false,
      showSearchPanel: false,
    })),

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

  addWords: (words) => set((state) => ({ sessionWords: state.sessionWords + words })),

  getStats: async (days) => {
    return await invoke<StatsSummary>("get_reading_stats", { days });
  },
}));

function prefetchChapter(bookId: string, chapterIndex: number) {
  if (chapterIndex < 0) return;
  void invoke<string>("get_chapter_content", { bookId, chapterIndex })
    .then(() => {
      /* cached by Rust/Tauri */
    })
    .catch(() => {
      /* best-effort */
    });
}
