import { useReaderStore } from "@/stores/readerStore";
import type { ChineseMode } from "@/types/reader";
import { Button } from "@/components/ui/button";
import { X, AlignJustify, Columns } from "lucide-react";
import { StylePresetList } from "@/components/reader/StylePresetList";
import { ReaderTypographyPanel } from "@/components/reader/ReaderTypographyPanel";
import { ReaderChromePanel } from "@/components/reader/ReaderChromePanel";
import { TapZoneConfigPanel } from "@/components/reader/TapZoneConfigPanel";

const CHINESE_MODE_OPTIONS: { value: ChineseMode; label: string }[] = [
  { value: "original", label: "原文" },
  { value: "simplified", label: "简体" },
  { value: "traditional", label: "繁體" },
];

export function ReaderSettings() {
  const { settingsState, patchInteraction, patchAssist, toggleSettings } = useReaderStore();

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-80 flex-col border-l bg-background shadow-xl">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">阅读设置</h2>
        <Button variant="ghost" size="icon" onClick={toggleSettings}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-6 overflow-auto p-4">
        <StylePresetList />
        <ReaderTypographyPanel />

        <section className="space-y-3">
          <h3 className="text-xs font-medium text-muted-foreground">阅读模式</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => patchInteraction({ scrollMode: "scroll" })}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border p-3 transition-colors ${settingsState.interaction.scrollMode === "scroll" ? "border-primary bg-accent" : "border-border hover:bg-accent"}`}
            >
              <AlignJustify className="h-4 w-4" />
              <span className="text-xs">滚动</span>
            </button>
            <button
              type="button"
              onClick={() => patchInteraction({ scrollMode: "paginated" })}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border p-3 transition-colors ${settingsState.interaction.scrollMode === "paginated" ? "border-primary bg-accent" : "border-border hover:bg-accent"}`}
            >
              <Columns className="h-4 w-4" />
              <span className="text-xs">翻页</span>
            </button>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-medium text-muted-foreground">阅读辅助</h3>
          <label className="block space-y-1 text-xs">
            <span className="text-muted-foreground">简繁显示</span>
            <select
              value={settingsState.assist.chineseMode}
              onChange={(event) =>
                patchAssist({ chineseMode: event.target.value as ChineseMode })
              }
              className="h-9 w-full rounded border bg-background px-2 text-xs outline-none focus:border-primary"
            >
              {CHINESE_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={settingsState.assist.searchCaseSensitive}
              onChange={(event) =>
                patchAssist({ searchCaseSensitive: event.target.checked })
              }
            />
            正文搜索区分大小写
          </label>
          <div>
            <label className="mb-1 flex justify-between text-xs">
              <span className="text-muted-foreground">朗读速度</span>
              <span className="font-medium">{settingsState.assist.ttsRate.toFixed(1)}x</span>
            </label>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={settingsState.assist.ttsRate}
              onChange={(event) => patchAssist({ ttsRate: Number(event.target.value) })}
              className="h-2 w-full cursor-pointer appearance-none rounded bg-muted accent-primary"
            />
          </div>
        </section>

        <ReaderChromePanel />
        <TapZoneConfigPanel />
      </div>
    </div>
  );
}
