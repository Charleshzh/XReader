import { describe, expect, it } from "vitest";
import { convertChinese } from "@/lib/chinese";

describe("convertChinese", () => {
  it("keeps original text in original mode", () => {
    expect(convertChinese("original", "繁體中文")).toBe("繁體中文");
  });
});
