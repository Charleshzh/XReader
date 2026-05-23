import { describe, expect, it } from "vitest";
import { clampPageIndex, pageIndexFromFraction, toChapterFraction } from "@/lib/paginatedLayout";

describe("paginatedLayout", () => {
  it("converts a page index into a 0..1 chapter fraction", () => {
    expect(toChapterFraction(0, 5)).toBe(0);
    expect(toChapterFraction(2, 5)).toBeCloseTo(0.5);
    expect(toChapterFraction(4, 5)).toBe(1);
  });

  it("clamps out-of-range page indexes", () => {
    expect(clampPageIndex(-1, 5)).toBe(0);
    expect(clampPageIndex(7, 5)).toBe(4);
  });

  it("restores the nearest page index from a chapter fraction", () => {
    expect(pageIndexFromFraction(0, 5)).toBe(0);
    expect(pageIndexFromFraction(0.51, 5)).toBe(2);
    expect(pageIndexFromFraction(1, 5)).toBe(4);
  });
});
