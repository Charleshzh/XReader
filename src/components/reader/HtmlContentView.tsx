import { useRef, useEffect, useCallback } from "react";
import { useReaderStore } from "@/stores/readerStore";

interface HtmlContentViewProps {
  content: string;
}

export function HtmlContentView({ content }: HtmlContentViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { settings, saveProgress, currentChapter, nextChapter, prevChapter } = useReaderStore();

  const { fontSize, lineHeight, marginH, marginV, scrollMode, fontFamily } = settings;

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const scrollTop = el.scrollTop;
    const scrollHeight = el.scrollHeight - el.clientHeight;
    const position = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
    saveProgress(currentChapter, position);
  }, [currentChapter, saveProgress]);

  // Reset scroll on content change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [content]);

  // Debounced scroll handler
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

  // Click zones for paginated mode
  const handleContentClick = useCallback(
    (e: React.MouseEvent) => {
      if (scrollMode !== "paginated") return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      // Left 30% = prev, right 70% = next
      if (x < rect.width * 0.3) {
        prevChapter();
      } else if (x > rect.width * 0.7) {
        nextChapter();
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
      {/* Click zone hints (paginated mode only) */}
      {scrollMode === "paginated" && (
        <>
          <div className="pointer-events-none fixed left-0 top-12 bottom-10 w-[30%] opacity-0 transition-opacity hover:opacity-100" />
          <div className="pointer-events-none fixed right-0 top-12 bottom-10 w-[30%] opacity-0 transition-opacity hover:opacity-100" />
        </>
      )}

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
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  );
}
