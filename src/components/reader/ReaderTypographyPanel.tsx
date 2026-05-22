import { Moon, BookOpen, Sun } from "lucide-react";
import { useReaderStore } from "@/stores/readerStore";
import type { ReaderTheme } from "@/types/reader";

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

export function ReaderTypographyPanel() {
  const { activeStyle, patchActiveStyle } = useReaderStore();

  return (
    <section className="space-y-4">
      <h3 className="text-xs font-medium text-muted-foreground">排版</h3>

      <div>
        <label className="mb-1 flex justify-between text-xs">
          <span className="text-muted-foreground">字号</span>
          <span className="font-medium">{activeStyle.fontSize}px</span>
        </label>
        <input
          type="range"
          min={10}
          max={40}
          value={activeStyle.fontSize}
          onChange={(event) => patchActiveStyle({ fontSize: Number(event.target.value) })}
          className="h-2 w-full cursor-pointer appearance-none rounded bg-muted accent-primary"
        />
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
          value={Math.round(activeStyle.lineHeight * 10)}
          onChange={(event) => patchActiveStyle({ lineHeight: Number(event.target.value) / 10 })}
          className="h-2 w-full cursor-pointer appearance-none rounded bg-muted accent-primary"
        />
      </div>

      <div>
        <label className="mb-1 flex justify-between text-xs">
          <span className="text-muted-foreground">字间距</span>
          <span className="font-medium">{activeStyle.letterSpacing.toFixed(1)}px</span>
        </label>
        <input
          type="range"
          min={-1}
          max={6}
          step={0.1}
          value={activeStyle.letterSpacing}
          onChange={(event) => patchActiveStyle({ letterSpacing: Number(event.target.value) })}
          className="h-2 w-full cursor-pointer appearance-none rounded bg-muted accent-primary"
        />
      </div>

      <div>
        <label className="mb-1 flex justify-between text-xs">
          <span className="text-muted-foreground">段距</span>
          <span className="font-medium">{activeStyle.paragraphSpacing}px</span>
        </label>
        <input
          type="range"
          min={0}
          max={24}
          value={activeStyle.paragraphSpacing}
          onChange={(event) => patchActiveStyle({ paragraphSpacing: Number(event.target.value) })}
          className="h-2 w-full cursor-pointer appearance-none rounded bg-muted accent-primary"
        />
      </div>

      <div>
        <label className="mb-1 flex justify-between text-xs">
          <span className="text-muted-foreground">段首缩进</span>
          <span className="font-medium">{activeStyle.paragraphIndent}em</span>
        </label>
        <input
          type="range"
          min={0}
          max={4}
          step={0.5}
          value={activeStyle.paragraphIndent}
          onChange={(event) => patchActiveStyle({ paragraphIndent: Number(event.target.value) })}
          className="h-2 w-full cursor-pointer appearance-none rounded bg-muted accent-primary"
        />
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
              type="button"
              onClick={() => patchActiveStyle({ theme: key })}
              className={`flex flex-1 flex-col items-center gap-1 rounded-lg border p-3 transition-colors ${activeStyle.theme === key ? "border-primary bg-accent" : "border-border hover:bg-accent"}`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
