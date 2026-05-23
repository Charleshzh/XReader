import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import { convertChinese } from "@/lib/chinese";
import { findContentMatches, highlightSearchMatches } from "@/lib/contentSearch";
import { highlightAnnotations } from "@/lib/highlight";
import { pageIndexFromFraction } from "@/lib/paginatedLayout";
import { resolveTapZone } from "@/lib/tapZones";
import { useReaderStore } from "@/stores/readerStore";

interface HtmlContentViewProps {
  content: string;
}

export function HtmlContentView({ content }: HtmlContentViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const {
    settingsState,
    activeStyle,
    annotations,
    currentChapter,
    currentPosition,
    currentPage,
    saveProgress,
    dispatchTapAction,
    searchQuery,
    searchMatches,
    currentSearchIndex,
    setSearchMatches,
  } = useReaderStore();

  const chapterAnnotations = useMemo(
    () =>
      annotations
        .filter((annotation) => annotation.chapter_index === currentChapter)
        .map((annotation) => ({ text: annotation.text, color: annotation.color })),
    [annotations, currentChapter],
  );

  const convertedContent = useMemo(
    () => convertChinese(settingsState.assist.chineseMode, content),
    [content, settingsState.assist.chineseMode],
  );

  const highlightedContent = useMemo(() => {
    const withAnnotations = highlightAnnotations(convertedContent, chapterAnnotations);
    return highlightSearchMatches(
      withAnnotations,
      searchQuery,
      settingsState.assist.searchCaseSensitive,
    );
  }, [chapterAnnotations, convertedContent, searchQuery, settingsState.assist.searchCaseSensitive]);

  const {
    fontSize,
    lineHeight,
    marginH,
    marginV,
    fontFamily,
    fontWeight,
    letterSpacing,
    paragraphSpacing,
    paragraphIndent,
  } = activeStyle;
  const isPaginated = settingsState.interaction.scrollMode === "paginated";

  const handleScroll = useCallback(() => {
    const element = containerRef.current;
    if (!element) return;
    const scrollTop = element.scrollTop;
    const scrollHeight = element.scrollHeight - element.clientHeight;
    const position = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
    void saveProgress(currentChapter, position);
  }, [currentChapter, saveProgress]);

  useEffect(() => {
    setSearchMatches(
      findContentMatches(convertedContent, searchQuery, settingsState.assist.searchCaseSensitive),
    );
  }, [convertedContent, searchQuery, setSearchMatches, settingsState.assist.searchCaseSensitive]);

  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;
    const paragraphs = article.querySelectorAll("p");
    paragraphs.forEach((paragraph, index) => {
      paragraph.style.textIndent = `${paragraphIndent}em`;
      paragraph.style.marginBottom =
        index === paragraphs.length - 1 ? "0px" : `${paragraphSpacing}px`;
    });
  }, [highlightedContent, paragraphIndent, paragraphSpacing]);

  useEffect(() => {
    if (searchMatches.length === 0) return;
    const article = articleRef.current;
    if (!article) return;
    const target = article.querySelector(
      `[data-search-index="${currentSearchIndex}"]`,
    ) as HTMLElement | null;
    target?.scrollIntoView({ block: isPaginated ? "nearest" : "center", inline: "center" });
  }, [currentSearchIndex, highlightedContent, isPaginated, searchMatches.length]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    if (isPaginated) {
      element.scrollTop = 0;
      return;
    }

    const maxScrollTop = element.scrollHeight - element.clientHeight;
    const nextScrollTop = maxScrollTop > 0 ? maxScrollTop * currentPosition : 0;
    if (Math.abs(element.scrollTop - nextScrollTop) > 2) {
      element.scrollTop = nextScrollTop;
    }
  }, [convertedContent, currentPosition, isPaginated]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || isPaginated) return;
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
  }, [handleScroll, isPaginated]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || !isPaginated) return;

    const updatePageWidth = () => {
      setPageWidth(element.clientWidth || 0);
    };

    updatePageWidth();
    const observer = new ResizeObserver(updatePageWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, [highlightedContent, isPaginated]);

  useEffect(() => {
    if (!isPaginated || pageWidth <= 0) return;
    const element = containerRef.current;
    const article = articleRef.current;
    if (!element || !article) return;

    const frame = window.requestAnimationFrame(() => {
      const pages = Math.max(1, Math.ceil(article.scrollWidth / pageWidth));
      const restoredPage = pageIndexFromFraction(currentPosition, pages);
      const nextLeft = restoredPage * pageWidth;
      if (Math.abs(element.scrollLeft - nextLeft) > 2) {
        element.scrollLeft = nextLeft;
      }
      const state = useReaderStore.getState();
      if (state.currentPage !== restoredPage || state.totalPages !== pages) {
        useReaderStore.setState({ currentPage: restoredPage, totalPages: pages });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [highlightedContent, currentPosition, isPaginated, pageWidth]);

  useEffect(() => {
    if (!isPaginated || pageWidth <= 0) return;
    const element = containerRef.current;
    if (!element) return;
    const desiredLeft = currentPage * pageWidth;
    if (Math.abs(element.scrollLeft - desiredLeft) > 2) {
      element.scrollLeft = desiredLeft;
    }
  }, [currentPage, isPaginated, pageWidth]);

  const handleContentClick = useCallback(
    (event: React.MouseEvent) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const zone = resolveTapZone({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        width: rect.width,
        height: rect.height,
      });
      void dispatchTapAction(zone);
    },
    [dispatchTapAction],
  );

  return (
    <div
      ref={containerRef}
      className="relative h-full select-none"
      style={{
        overflowY: isPaginated ? "hidden" : "auto",
        overflowX: "hidden",
      }}
      onClick={handleContentClick}
    >
      <article
        ref={articleRef}
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
            columnWidth: isPaginated && pageWidth > 0 ? `${pageWidth}px` : undefined,
            columnGap: isPaginated ? "0px" : undefined,
            maxWidth: isPaginated ? "none" : undefined,
            height: isPaginated ? "100%" : undefined,
          } as React.CSSProperties
        }
        dangerouslySetInnerHTML={{ __html: highlightedContent }}
      />
    </div>
  );
}
