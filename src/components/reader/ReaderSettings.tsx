import { useReaderStore } from "@/stores/readerStore";
import type { ReaderTheme } from "@/types/reader";
import { Button } from "@/components/ui/button";
import { X, Sun, Moon, BookOpen, AlignJustify, Columns } from "lucide-react";

const THEMES: { key: ReaderTheme; label: string; icon: typeof Sun }[] = [
  { key: "light", label: "亮色", icon: Sun },
  { key: "dark", label: "暗色", icon: Moon },
  { key: "sepia", label: "护眼", icon: BookOpen },
];

const FONTS = [
  { value: "system-ui, -apple-system, sans-serif", label: "系统默认" },
  { value: '"Noto Serif SC", "Source Han Serif SC", serif', label: "宋体" },
  { value: '"Noto Sans SC", "Source Han Sans SC", sans-serif', label: "黑体" },
  { value: '"LXGW WenKai", "KaiTi",楷体, serif', label: "楷体" },
  { value: "monospace", label: "等宽" },
];

export function ReaderSettings() {
  const { activeStyle, settingsState, patchActiveStyle, patchInteraction, toggleSettings } =
    useReaderStore();

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-72 flex-col border-l bg-background shadow-xl">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">阅读设置</h2>
        <Button variant="ghost" size="icon" onClick={toggleSettings}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-5 overflow-auto p-4">
        <div>
          <label className="mb-1 flex justify-between text-xs">
            <span className="text-muted-foreground">字号</span>
            <span className="font-medium">{activeStyle.fontSize}px</span>
          </label>
          <input
            type="range"
            min={10}
            max={32}
            step={1}
            value={activeStyle.fontSize}
            onChange={(event) => patchActiveStyle({ fontSize: Number(event.target.value) })}
            className="h-2 w-full cursor-pointer appearance-none rounded bg-muted accent-primary"
          />
          <div className="mt-0.5 flex justify-between text-[10px] text-muted-foreground">
            <span>10</span>
            <span>32</span>
          </div>
        </div>

        <div>
          <label className="mb-1 flex justify-between text-xs">
            <span className="text-muted-foreground">行高</span>
            <span className="font-medium">{activeStyle.lineHeight.toFixed(1)}x</span>
          </label>
          <input
            type="range"
            min={10}
            max={30}
            step={1}
            value={Math.round(activeStyle.lineHeight * 10)}
            onChange={(event) => patchActiveStyle({ lineHeight: Number(event.target.value) / 10 })}
            className="h-2 w-full cursor-pointer appearance-none rounded bg-muted accent-primary"
          />
          <div className="mt-0.5 flex justify-between text-[10px] text-muted-foreground">
            <span>1.0</span>
            <span>3.0</span>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium text-muted-foreground">字体</label>
          <select
            value={activeStyle.fontFamily}
            onChange={(event) => patchActiveStyle({ fontFamily: event.target.value })}
            className="h-9 w-full rounded border bg-background px-2 text-xs outline-none focus:border-primary"
          >
            {FONTS.map((font) => (
              <option key={font.value} value={font.value}>
                {font.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium text-muted-foreground">主题</label>
          <div className="flex gap-2">
            {THEMES.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => patchActiveStyle({ theme: key })}
                className={`flex flex-1 flex-col items-center gap-1 rounded-lg border p-3 transition-colors ${activeStyle.theme === key ? "border-primary bg-accent" : "border-border hover:bg-accent"}`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium text-muted-foreground">阅读模式</label>
          <div className="flex gap-2">
            <button
              onClick={() => patchInteraction({ scrollMode: "scroll" })}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border p-3 transition-colors ${settingsState.interaction.scrollMode === "scroll" ? "border-primary bg-accent" : "border-border hover:bg-accent"}`}
            >
              <AlignJustify className="h-4 w-4" />
              <span className="text-xs">滚动</span>
            </button>
            <button
              onClick={() => patchInteraction({ scrollMode: "paginated" })}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border p-3 transition-colors ${settingsState.interaction.scrollMode === "paginated" ? "border-primary bg-accent" : "border-border hover:bg-accent"}`}
            >
              <Columns className="h-4 w-4" />
              <span className="text-xs">翻页</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
