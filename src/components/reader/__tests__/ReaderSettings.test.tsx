import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReaderSettings } from "@/components/reader/ReaderSettings";
import { createInitialReaderRuntimeState, useReaderStore } from "@/stores/readerStore";
import { cloneReaderSettingsState, DEFAULT_READER_SETTINGS_STATE } from "@/types/reader";

describe("ReaderSettings", () => {
  beforeEach(() => {
    const settingsState = cloneReaderSettingsState(DEFAULT_READER_SETTINGS_STATE);
    useReaderStore.setState({
      ...createInitialReaderRuntimeState(),
      settingsState,
      activeStyle: settingsState.styles[0],
    });
  });

  it("switches presets and updates typography controls", async () => {
    const user = userEvent.setup();
    const baseStyle = cloneReaderSettingsState(DEFAULT_READER_SETTINGS_STATE).styles[0];

    useReaderStore.setState({
      settingsState: {
        version: 1,
        activeStyleId: "default",
        styles: [
          { ...baseStyle, id: "default", name: "默认" },
          { ...baseStyle, id: "night", name: "夜读", theme: "dark" },
        ],
        interaction: cloneReaderSettingsState(DEFAULT_READER_SETTINGS_STATE).interaction,
        assist: cloneReaderSettingsState(DEFAULT_READER_SETTINGS_STATE).assist,
      },
      activeStyle: { ...baseStyle, id: "default", name: "默认" },
    });

    render(<ReaderSettings />);

    await user.click(screen.getByRole("button", { name: "夜读" }));

    expect(useReaderStore.getState().settingsState.activeStyleId).toBe("night");
    expect(screen.getByText("页眉")).toBeInTheDocument();
  });
});
