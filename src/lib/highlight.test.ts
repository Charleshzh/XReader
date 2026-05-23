import { describe, expect, it } from "vitest";
import { highlightAnnotations, type HighlightAnnotation } from "@/lib/highlight";

const ann = (text: string, color = "yellow"): HighlightAnnotation => ({ text, color });

describe("highlightAnnotations", () => {
  it("returns the original html when there are no annotations", () => {
    expect(highlightAnnotations("<p>正文</p>", [])).toBe("<p>正文</p>");
  });

  it("wraps a single annotation in a <mark>", () => {
    const html = highlightAnnotations("<p>测试正文</p>", [ann("测试")]);
    expect(html).toContain("<mark");
    expect(html).toContain("测试");
    expect(html).toContain("bg-yellow-200");
  });

  it("skips empty annotation text", () => {
    expect(highlightAnnotations("<p>正文</p>", [ann("   ")])).toBe("<p>正文</p>");
  });

  it("avoids overlapping spans", () => {
    const html = highlightAnnotations("<p>测试测试</p>", [
      ann("测试测试", "pink"),
      ann("测试", "blue"),
    ]);
    expect((html.match(/<mark/g) ?? []).length).toBe(1);
  });

  it("falls back to yellow for unknown colors", () => {
    const html = highlightAnnotations("<p>正文</p>", [{ text: "正文", color: "purple" }]);
    expect(html).toContain("bg-yellow-200");
  });
});
