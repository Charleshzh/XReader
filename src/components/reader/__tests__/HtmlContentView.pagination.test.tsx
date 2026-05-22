import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { HtmlContentView } from "@/components/reader/HtmlContentView";
import { createInitialReaderRuntimeState, useReaderStore } from "@/stores/readerStore";
import { cloneReaderSettingsState, DEFAULT_READER_SETTINGS_STATE } from "@/types/reader";

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    disconnect() {}
    unobserve() {}
  }

  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    writable: true,
    value: ResizeObserverMock,
  });
});

describe("HtmlContentView paginated mode", () => {
  beforeEach(() => {
    const settingsState = cloneReaderSettingsState(DEFAULT_READER_SETTINGS_STATE);
    settingsState.interaction.scrollMode = "paginated";
    useReaderStore.setState({
      ...createInitialReaderRuntimeState(),
      settingsState,
      activeStyle: settingsState.styles[0],
      nextPage: vi.fn().mockResolvedValue(undefined),
      prevPage: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("routes right-side taps to nextPage when paginated", () => {
    const { container } = render(<HtmlContentView content="<p>正文</p>" />);
    const viewer = container.firstElementChild as HTMLDivElement;
    vi.spyOn(viewer, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 900,
      bottom: 600,
      width: 900,
      height: 600,
      toJSON: () => ({}),
    });

    fireEvent.click(viewer, { clientX: 850, clientY: 200 });

    expect(useReaderStore.getState().nextPage).toHaveBeenCalled();
  });
});
