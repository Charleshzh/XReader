import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTts } from "@/hooks/useTts";

class MockSpeechSynthesisUtterance {
  text: string;
  lang = "";
  rate = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

describe("useTts", () => {
  beforeEach(() => {
    const speechSynthesis = {
      speak: vi.fn(),
      cancel: vi.fn(),
    };

    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      writable: true,
      value: speechSynthesis,
    });
    Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
      configurable: true,
      writable: true,
      value: MockSpeechSynthesisUtterance,
    });
  });

  it("queues speech and can stop playback", () => {
    const { result } = renderHook(() => useTts("第一句。第二句。", 1));

    act(() => {
      result.current.play();
    });

    expect(window.speechSynthesis.speak).toHaveBeenCalled();

    act(() => {
      result.current.stop();
    });

    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
  });
});
