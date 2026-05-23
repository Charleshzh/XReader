import { describe, expect, it } from "vitest";
import { splitIntoUtteranceChunks } from "@/lib/tts";

describe("splitIntoUtteranceChunks", () => {
  it("splits long text into bounded utterance chunks", () => {
    const text = "第一句。".repeat(2000);
    const chunks = splitIntoUtteranceChunks(text, 2000);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 2000)).toBe(true);
  });
});
