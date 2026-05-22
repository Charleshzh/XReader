import { useRef, useEffect, useCallback } from "react";
import { useReaderStore } from "@/stores/readerStore";

interface HtmlContentViewProps {
  content: string;
}

export function HtmlContentView({ content }: HtmlContentViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { settings, saveProgress, currentChapter } = useReaderStore();

  const { fontSize, lineHeight, marginH, marginV, scrollMode } = settings;

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

  return (
    <div
      ref={containerRef}
      className="h-full"
      style={{
        overflowY: scrollMode === "scroll" ? "auto" : "hidden",
        overflowX: "hidden",
      }}
    >
      <article
        className="mx-auto min-h-full max-w-3xl px-[var(--margin-h)] py-[var(--margin-v)]"
        style={{
          // @ts-expect-error CSS custom properties
          "--margin-h": `${marginH}%`,
          "--margin-v": `${marginV}px`,
          fontSize: `${fontSize}px`,
          lineHeight: lineHeight,
        }}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  );
}
