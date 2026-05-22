import { describe, expect, it } from "vitest";
import { resolveTapZone } from "@/lib/tapZones";

describe("resolveTapZone", () => {
  it("maps a point to a 3x3 region", () => {
    expect(resolveTapZone({ x: 10, y: 10, width: 300, height: 300 })).toBe("tl");
    expect(resolveTapZone({ x: 150, y: 150, width: 300, height: 300 })).toBe("mc");
    expect(resolveTapZone({ x: 280, y: 280, width: 300, height: 300 })).toBe("br");
  });
});
