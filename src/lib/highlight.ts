export interface HighlightAnnotation {
  text: string;
  color: string;
}

const COLOR_MAP: Record<string, string> = {
  yellow: "bg-yellow-200 dark:bg-yellow-800",
  green: "bg-green-200 dark:bg-green-800",
  blue: "bg-blue-200 dark:bg-blue-800",
  pink: "bg-pink-200 dark:bg-pink-800",
  orange: "bg-orange-200 dark:bg-orange-800",
};

interface Span {
  start: number;
  end: number;
  color: string;
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "");
}

export function highlightAnnotations(html: string, annotations: HighlightAnnotation[]): string {
  if (annotations.length === 0) return html;

  const plainText = stripHtml(html);
  const spans: Span[] = [];

  for (const annotation of annotations) {
    if (!annotation.text.trim()) continue;

    let index = 0;
    while (index < plainText.length) {
      const start = plainText.indexOf(annotation.text, index);
      if (start === -1) break;

      const end = start + annotation.text.length;
      const overlaps = spans.some((span) => start < span.end && end > span.start);
      if (!overlaps) {
        spans.push({ start, end, color: annotation.color });
      }

      index = end;
    }
  }

  if (spans.length === 0) return html;

  spans.sort((left, right) => left.start - right.start);

  let result = "";
  let htmlPos = 0;
  let plainPos = 0;

  for (const span of spans) {
    while (plainPos < span.start && htmlPos < html.length) {
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
      }
    }

    const colorClass = COLOR_MAP[span.color] ?? COLOR_MAP.yellow;
    result += `<mark class="${colorClass} bg-opacity-40 dark:bg-opacity-40 rounded-sm">`;

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

  return result + html.slice(htmlPos);
}
