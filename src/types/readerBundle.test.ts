import { describe, expect, it } from "vitest";
import { isReaderBundle } from "@/types/readerBundle";

describe("isReaderBundle", () => {
  it("accepts a v1 XReader reader bundle", () => {
    expect(
      isReaderBundle({
        kind: "xreader-reader-bundle",
        version: 1,
        exportedAt: "2026-05-22T00:00:00.000Z",
        settings: {
          version: 1,
          activeStyleId: "default",
          styles: [],
          interaction: {
            scrollMode: "paginated",
            pageTurn: "none",
            autoPageSeconds: null,
            tapZones: {},
          },
          assist: {
            chineseMode: "original",
            ttsRate: 1,
            searchCaseSensitive: false,
          },
        },
        extensions: {},
      }),
    ).toBe(true);
  });
});
