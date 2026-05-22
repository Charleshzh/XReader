import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialReaderRuntimeState, useReaderStore } from "@/stores/readerStore";
import { cloneReaderSettingsState, DEFAULT_READER_SETTINGS_STATE } from "@/types/reader";

describe("reader interaction actions", () => {
  beforeEach(() => {
    const settingsState = cloneReaderSettingsState(DEFAULT_READER_SETTINGS_STATE);
    useReaderStore.setState({
      ...createInitialReaderRuntimeState(),
      settingsState,
      activeStyle: settingsState.styles[0],
    });
  });

  it("dispatches tap actions through the configured zone map", async () => {
    const nextPage = vi.fn().mockResolvedValue(undefined);
    const settingsState = cloneReaderSettingsState(DEFAULT_READER_SETTINGS_STATE);
    settingsState.interaction.tapZones = {
      tl: "menu",
      tc: "noop",
      tr: "next-page",
      ml: "prev-page",
      mc: "menu",
      mr: "next-page",
      bl: "bookmark",
      bc: "search",
      br: "next-chapter",
    };

    useReaderStore.setState({
      settingsState,
      activeStyle: settingsState.styles[0],
      nextPage,
    });

    await useReaderStore.getState().dispatchTapAction("tr");

    expect(nextPage).toHaveBeenCalled();
  });
});
