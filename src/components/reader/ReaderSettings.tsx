import { useReaderStore } from "@/stores/readerStore";
import type { ReaderSettings } from "@/types/reader";
import { Button } from "@/components/ui/button";
import { X, Sun, Moon, BookOpen, AlignJustify, Columns } from "lucide-react";

const FONT_SIZES = [14, 16, 18, 20, 22, 24, 28];
const LINE_HEIGHTS = [1.4, 1.6, 1.8, 2.0, 2.2, 2.5];
const THEMES: { key: ReaderSettings["theme"]; label: string; icon: typeof Sun }[] = [
  { key: "light", label: "亮色", icon: Sun },
  { key: "dark", label: "暗色", icon: Moon },
  { key: "sepia", label: "护眼", icon: BookOpen },
];

export function ReaderSettings() {
  const { settings, updateSettings, toggleSettings } = useReaderStore();

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-72 flex-col border-l bg-background shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">阅读设置</h2>
        <Button variant="ghost" size="icon" onClick={toggleSettings}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-5 overflow-auto p-4">
        {/* Font size */}
        <div>
          <label className="mb-2 block text-xs font-medium text-muted-foreground">
            字号
          </label>
          <div className="flex flex-wrap gap-1.5">
            {FONT_SIZES.map((size) => (
              <button
                key={size}
                onClick={() => updateSettings({ fontSize: size })}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  settings.fontSize === size
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-accent"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* Line height */}
        <div>
          <label className="mb-2 block text-xs font-medium text-muted-foreground">
            行高
          </label>
          <div className="flex flex-wrap gap-1.5">
            {LINE_HEIGHTS.map((lh) => (
              <button
                key={lh}
                onClick={() => updateSettings({ lineHeight: lh })}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  settings.lineHeight === lh
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-accent"
                }`}
              >
                {lh}x
              </button>
            ))}
          </div>
        </div>

        {/* Theme */}
        <div>
          <label className="mb-2 block text-xs font-medium text-muted-foreground">
            主题
          </label>
          <div className="flex gap-2">
            {THEMES.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => updateSettings({ theme: key })}
                className={`flex flex-1 flex-col items-center gap-1 rounded-lg border p-3 transition-colors ${
                  settings.theme === key
                    ? "border-primary bg-accent"
                    : "border-border hover:bg-accent"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Scroll mode */}
        <div>
          <label className="mb-2 block text-xs font-medium text-muted-foreground">
            阅读模式
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => updateSettings({ scrollMode: "scroll" })}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border p-3 transition-colors ${
                settings.scrollMode === "scroll"
                  ? "border-primary bg-accent"
                  : "border-border hover:bg-accent"
              }`}
            >
              <AlignJustify className="h-4 w-4" />
              <span className="text-xs">滚动</span>
            </button>
            <button
              onClick={() => updateSettings({ scrollMode: "paginated" })}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border p-3 transition-colors ${
                settings.scrollMode === "paginated"
                  ? "border-primary bg-accent"
                  : "border-border hover:bg-accent"
              }`}
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
