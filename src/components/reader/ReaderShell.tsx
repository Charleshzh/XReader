import { type ReactNode, useCallback, useEffect, useRef } from "react";
import { useReaderStore } from "@/stores/readerStore";
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
    settings,
    nextChapter,
    prevChapter,
    toggleToc,
    toggleSettings,
    toggleBookmarks,
    toggleAnnotations,
    endSession,
  } = useReaderStore();

  const isPaginated = settings.scrollMode === "paginated";

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        if (isPaginated && currentChapter < chapters.length - 1) {
          nextChapter();
        }
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        if (isPaginated && currentChapter > 0) {
          prevChapter();
        }
      }
    },
    [isPaginated, currentChapter, chapters.length, nextChapter, prevChapter],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Theme classes
  const themeClass = {
    light: "bg-white text-gray-900",
    dark: "bg-gray-900 text-gray-100",
    sepia: "bg-amber-50 text-amber-950",
  }[settings.theme];

  // Reading session timer: tick every 10 seconds
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    timerRef.current = setInterval(() => {
      useReaderStore.setState((s) => ({
        sessionSeconds: s.sessionSeconds + 10,
      }));
    }, 10000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleBack = () => {
    endSession();
    onBack();
  };

  return (
    <div className={`flex h-full flex-col ${themeClass}`}>
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border/50 px-3">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 truncate px-3 text-center text-sm">
          <span className="font-medium">{title}</span>
          {chapterTitle && <span className="ml-2 text-muted-foreground">· {chapterTitle}</span>}
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

      {/* Content area */}
      <main className="flex-1 overflow-hidden">{children}</main>

      {/* Bottom bar */}
      <footer className="flex h-10 shrink-0 items-center justify-between border-t border-border/50 px-4 text-xs text-muted-foreground">
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
      </footer>
    </div>
  );
}
