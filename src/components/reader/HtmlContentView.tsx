import { useRef, useEffect, useCallback, useMemo } from "react";
import { useReaderStore } from "@/stores/readerStore";

interface HtmlContentViewProps {
  content: string;
}

/** Wrap annotation text ranges with <mark> tags for visual highlighting. */
function highlightAnnotations(
  html: string,
  annotations: { text: string; color: string }[],
): string {
  if (annotations.length === 0) return html;

  // Extract plain text from HTML to locate annotation positions
  const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "");
  const plainText = stripHtml(html);

  // Collect annotation matches: each maps to a plain-text span
  interface Span {
    start: number;
    end: number;
    color: string;
  }
  const spans: Span[] = [];
  for (const ann of annotations) {
    if (!ann.text.trim()) continue;
    let idx = 0;
    // Find all occurrences of annotation text in plain text
    while (idx < plainText.length) {
      const found = plainText.indexOf(ann.text, idx);
      if (found === -1) break;
      // Avoid overlapping spans (simple check)
      const overlap = spans.some((s) => found < s.end && found + ann.text.length > s.start);
      if (!overlap) {
        spans.push({
          start: found,
          end: found + ann.text.length,
          color: ann.color,
        });
      }
      idx = found + ann.text.length;
    }
  }

  if (spans.length === 0) return html;

  // Sort spans by start position
  spans.sort((a, b) => a.start - b.start);

  // Build highlighted HTML by walking through plain text positions
  let result = "";
  let htmlPos = 0;
  let plainPos = 0;

  for (const span of spans) {
    // Copy HTML characters up to span start
    while (plainPos < span.start && htmlPos < html.length) {
      const ch = html[htmlPos];
      result += ch;
      htmlPos++;
      if (ch === "<") {
        // Skip tag: copy until >
        while (htmlPos < html.length && html[htmlPos] !== ">") {
          result += html[htmlPos];
          htmlPos++;
        }
        if (htmlPos < html.length) {
          result += html[htmlPos]; // the >
          htmlPos++;
        }
      } else {
        plainPos++;
      }
    }

    // Insert mark tag
    const colorClass = COLOR_MAP[span.color] || "bg-yellow-200 dark:bg-yellow-800";
    result += `<mark class="${colorClass} bg-opacity-40 dark:bg-opacity-40 rounded-sm">`;

    // Copy HTML characters for the span
    let spanPlain = 0;
    while (spanPlain < span.end - span.start && htmlPos < html.length) {
      const ch = html[htmlPos];
      result += ch;
      htmlPos++;
      if (ch === "<") {
        while (htmlPos < html.length && html[htmlPos] !== ">") {
          result += html[htmlPos];
          htmlPos++;
        }
        if (htmlPos < html.length) {
          result += html[htmlPos];
          htmlPos++;
        }
      } else {
        plainPos++;
        spanPlain++;
      }
    }

    result += "</mark>";
  }

  // Copy remaining HTML
  result += html.slice(htmlPos);

  return result;
}

const COLOR_MAP: Record<string, string> = {
  yellow: "bg-yellow-200 dark:bg-yellow-800",
  green: "bg-green-200 dark:bg-green-800",
  blue: "bg-blue-200 dark:bg-blue-800",
  pink: "bg-pink-200 dark:bg-pink-800",
  orange: "bg-orange-200 dark:bg-orange-800",
};

export function HtmlContentView({ content }: HtmlContentViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { settings, annotations, currentChapter, saveProgress, nextChapter, prevChapter } =
    useReaderStore();

  // Filter annotations for current chapter
  const chapterAnnotations = useMemo(
    () =>
      annotations
        .filter((a) => a.chapter_index === currentChapter)
        .map((a) => ({ text: a.text, color: a.color })),
    [annotations, currentChapter],
  );

  // Highlighted content
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
    saveProgress(currentChapter, position);
  }, [currentChapter, saveProgress]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [content]);

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
