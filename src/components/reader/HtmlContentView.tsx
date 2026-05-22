import { useRef, useEffect, useCallback, useMemo } from "react";
import { highlightAnnotations } from "@/lib/highlight";
import { useReaderStore } from "@/stores/readerStore";

interface HtmlContentViewProps {
  content: string;
}

export function HtmlContentView({ content }: HtmlContentViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    settings,
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
        .filter((a) => a.chapter_index === currentChapter)
        .map((a) => ({ text: a.text, color: a.color })),
    [annotations, currentChapter],
  );

  const highlightedContent = useMemo(
    () => highlightAnnotations(content, chapterAnnotations),
    [content, chapterAnnotations],
  );

  const { fontSize, lineHeight, marginH, marginV, scrollMode, fontFamily } = settings;

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const scrollTop = el.scrollTop;
    const scrollHeight = el.scrollHeight - el.clientHeight;
    const position = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
    void saveProgress(currentChapter, position);
  }, [currentChapter, saveProgress]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (scrollMode !== "scroll") {
      el.scrollTop = 0;
      return;
    }

    const maxScrollTop = el.scrollHeight - el.clientHeight;
    const nextScrollTop = maxScrollTop > 0 ? maxScrollTop * currentPosition : 0;
    if (Math.abs(el.scrollTop - nextScrollTop) > 2) {
      el.scrollTop = nextScrollTop;
    }
  }, [content, currentPosition, scrollMode]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || scrollMode !== "scroll") return;
    let timer: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(handleScroll, 500);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
    };
  }, [handleScroll, scrollMode]);

  const handleContentClick = useCallback(
    (e: React.MouseEvent) => {
      if (scrollMode !== "paginated") return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
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
            lineHeight: lineHeight,
            fontFamily: fontFamily,
          } as React.CSSProperties
        }
        dangerouslySetInnerHTML={{ __html: highlightedContent }}
      />
    </div>
  );
}
