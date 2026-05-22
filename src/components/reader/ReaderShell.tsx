import { type ReactNode, useCallback, useEffect, useRef } from "react";
import { useReaderStore } from "@/stores/readerStore";
import type { ChromeItem, ReaderChromeRow } from "@/types/reader";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Highlighter,
  List,
  Settings,
} from "lucide-react";

interface ReaderShellProps {
  title: string;
  chapterTitle: string;
  onBack: () => void;
  children: ReactNode;
}

export function ReaderShell({ title, chapterTitle, onBack, children }: ReaderShellProps) {
  const {
    currentChapter,
    chapters,
    settingsState,
    activeStyle,
    nextChapter,
    prevChapter,
    toggleToc,
    toggleSettings,
    toggleBookmarks,
    toggleAnnotations,
    endSession,
  } = useReaderStore();

  const isPaginated = settingsState.interaction.scrollMode === "paginated";

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        if (isPaginated && currentChapter < chapters.length - 1) {
          void nextChapter();
        }
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        if (isPaginated && currentChapter > 0) {
          void prevChapter();
        }
      }
    },
    [isPaginated, currentChapter, chapters.length, nextChapter, prevChapter],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const themeClass = {
    light: "bg-white text-gray-900",
    dark: "bg-gray-900 text-gray-100",
    sepia: "bg-amber-50 text-amber-950",
    green: "bg-emerald-50 text-emerald-950",
    gray: "bg-slate-100 text-slate-900",
    black: "bg-black text-gray-100",
  }[activeStyle.theme];

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    timerRef.current = setInterval(() => {
      useReaderStore.setState((state) => ({
        sessionSeconds: state.sessionSeconds + 10,
      }));
    }, 10000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleBack = () => {
    void endSession();
    onBack();
  };

  const renderChromeItem = useCallback(
    (item: ChromeItem) => {
      switch (item) {
        case "book":
          return title;
        case "chapter":
          return chapterTitle || `第 ${currentChapter + 1} 章`;
        case "clock":
          return new Date().toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
          });
        case "progress":
          return `${currentChapter + 1}/${chapters.length}`;
        default:
          return "";
      }
    },
    [chapterTitle, chapters.length, currentChapter, title],
  );

  const hasChromeContent = (row: ReaderChromeRow) =>
    row.left !== "none" || row.center !== "none" || row.right !== "none";

  const renderChromeRow = (row: ReaderChromeRow, dividerClass: string) => (
    <div
      className={`grid grid-cols-3 gap-2 px-4 py-1 text-[10px] text-muted-foreground ${row.showDivider ? dividerClass : ""}`}
    >
      <span className="truncate text-left">{renderChromeItem(row.left)}</span>
      <span className="truncate text-center">{renderChromeItem(row.center)}</span>
      <span className="truncate text-right">{renderChromeItem(row.right)}</span>
    </div>
  );

  const showToolbarTitle = activeStyle.titleMode !== "hidden";

  return (
    <div className={`flex h-full flex-col ${themeClass}`}>
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border/50 px-3">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 truncate px-3 text-center text-sm" style={{ fontSize: activeStyle.titleSize }}>
          {showToolbarTitle ? (
            <span className="font-medium">{title}</span>
          ) : (
            <span className="sr-only">{title}</span>
          )}
          {showToolbarTitle && chapterTitle ? (
            <span className="ml-2 text-muted-foreground">· {chapterTitle}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={toggleToc}>
            <List className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleSettings}>
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleBookmarks}>
            <Bookmark className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleAnnotations}>
            <Highlighter className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {hasChromeContent(activeStyle.header)
        ? renderChromeRow(activeStyle.header, "border-b border-border/50")
        : null}

      <main className="flex-1 overflow-hidden">{children}</main>

      <footer className="shrink-0 border-t border-border/50">
        {hasChromeContent(activeStyle.footer)
          ? renderChromeRow(activeStyle.footer, "border-b border-border/50")
          : null}
        <div className="flex h-10 items-center justify-between px-4 text-xs text-muted-foreground">
          <Button variant="ghost" size="sm" onClick={prevChapter} disabled={currentChapter === 0}>
            <ChevronLeft className="mr-1 h-3 w-3" />
            上一章
          </Button>
          <span>
            {currentChapter + 1} / {chapters.length}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={nextChapter}
            disabled={currentChapter >= chapters.length - 1}
          >
            下一章
            <ChevronRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </footer>
    </div>
  );
}
