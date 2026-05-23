import { describe, expect, it } from "vitest";
import { migrateReaderSettings } from "@/lib/migrateReaderSettings";

describe("migrateReaderSettings", () => {
  it("upgrades the current flat settings shape into the new state tree", () => {
    const migrated = migrateReaderSettings({
      fontSize: 18,
      lineHeight: 1.8,
      marginH: 5,
      marginV: 40,
      theme: "light",
      scrollMode: "paginated",
      fontFamily: "system-ui, -apple-system, sans-serif",
    });

    expect(migrated.version).toBe(1);
    expect(migrated.styles).toHaveLength(1);
    expect(migrated.styles[0].fontSize).toBe(18);
    expect(migrated.interaction.scrollMode).toBe("paginated");
  });

  it("returns defaults when the payload is invalid", () => {
    const migrated = migrateReaderSettings("not-json-compatible");
    expect(migrated.styles).toHaveLength(1);
    expect(migrated.activeStyleId).toBe(migrated.styles[0].id);
  });
});
