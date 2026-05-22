import { useRef, useEffect, useCallback, useMemo } from "react";
import { highlightAnnotations } from "@/lib/highlight";
import { useReaderStore } from "@/stores/readerStore";

interface HtmlContentViewProps {
  content: string;
}

export function HtmlContentView({ content }: HtmlContentViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    settingsState,
    activeStyle,
    annotations,
    currentChapter,
    currentPosition,
    saveProgress,
    nextChapter,
    prevChapter,
  } = useReaderStore();

  const chapterAnnotations = useMemo(
    () =>
      annotations
        .filter((annotation) => annotation.chapter_index === currentChapter)
        .map((annotation) => ({ text: annotation.text, color: annotation.color })),
    [annotations, currentChapter],
  );

  const highlightedContent = useMemo(
    () => highlightAnnotations(content, chapterAnnotations),
    [content, chapterAnnotations],
  );

  const { fontSize, lineHeight, marginH, marginV, fontFamily, fontWeight, letterSpacing } =
    activeStyle;
  const scrollMode = settingsState.interaction.scrollMode;

  const handleScroll = useCallback(() => {
    const element = containerRef.current;
    if (!element) return;
    const scrollTop = element.scrollTop;
    const scrollHeight = element.scrollHeight - element.clientHeight;
    const position = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
    void saveProgress(currentChapter, position);
  }, [currentChapter, saveProgress]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    if (scrollMode !== "scroll") {
      element.scrollTop = 0;
      return;
    }

    const maxScrollTop = element.scrollHeight - element.clientHeight;
    const nextScrollTop = maxScrollTop > 0 ? maxScrollTop * currentPosition : 0;
    if (Math.abs(element.scrollTop - nextScrollTop) > 2) {
      element.scrollTop = nextScrollTop;
    }
  }, [content, currentPosition, scrollMode]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || scrollMode !== "scroll") return;
    let timer: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(handleScroll, 500);
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      element.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
    };
  }, [handleScroll, scrollMode]);

  const handleContentClick = useCallback(
    (event: React.MouseEvent) => {
      if (scrollMode !== "paginated") return;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      if (x < rect.width * 0.3) {
        void prevChapter();
      } else if (x > rect.width * 0.7) {
        void nextChapter();
      }
    },
    [scrollMode, prevChapter, nextChapter],
  );

  return (
    <div
      ref={containerRef}
      className="relative h-full select-none"
      style={{
        overflowY: scrollMode === "scroll" ? "auto" : "hidden",
        overflowX: "hidden",
      }}
      onClick={handleContentClick}
    >
      <article
        className="mx-auto min-h-full max-w-3xl px-[var(--margin-h)] py-[var(--margin-v)]"
        style={
          {
            "--margin-h": `${marginH}%`,
            "--margin-v": `${marginV}px`,
            fontSize: `${fontSize}px`,
            lineHeight,
            fontFamily,
            fontWeight,
            letterSpacing: `${letterSpacing}px`,
          } as React.CSSProperties
        }
        dangerouslySetInnerHTML={{ __html: highlightedContent }}
      />
    </div>
  );
}
