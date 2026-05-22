import { useReaderStore } from "@/stores/readerStore";
import { Button } from "@/components/ui/button";
import { X, AlignJustify, Columns } from "lucide-react";
import { StylePresetList } from "@/components/reader/StylePresetList";
import { ReaderTypographyPanel } from "@/components/reader/ReaderTypographyPanel";
import { ReaderChromePanel } from "@/components/reader/ReaderChromePanel";

export function ReaderSettings() {
  const { settingsState, patchInteraction, toggleSettings } = useReaderStore();

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

        <ReaderChromePanel />
      </div>
    </div>
  );
}
