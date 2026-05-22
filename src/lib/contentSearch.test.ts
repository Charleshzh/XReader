import { describe, expect, it } from "vitest";
import { findContentMatches } from "@/lib/contentSearch";

describe("findContentMatches", () => {
  it("finds case-insensitive matches in stripped html", () => {
    const matches = findContentMatches("<p>雪中 悍刀行</p><p>雪中</p>", "雪中", false);
    expect(matches).toHaveLength(2);
  });
});
