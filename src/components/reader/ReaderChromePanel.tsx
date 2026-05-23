import { useReaderStore } from "@/stores/readerStore";
import type { ChromeItem, ReaderChromeRow } from "@/types/reader";

const ITEMS: { value: ChromeItem; label: string }[] = [
  { value: "none", label: "无" },
  { value: "book", label: "书名" },
  { value: "chapter", label: "章节" },
  { value: "clock", label: "时间" },
  { value: "progress", label: "进度" },
];

interface ChromeRowEditorProps {
  title: string;
  row: ReaderChromeRow;
  onChange: (next: ReaderChromeRow) => void;
}

function ChromeRowEditor({ title, row, onChange }: ChromeRowEditorProps) {
  const updateSlot = (slot: "left" | "center" | "right", value: ChromeItem) => {
    onChange({ ...row, [slot]: value });
  };

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium">{title}</h4>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <label className="space-y-1">
          <span className="text-muted-foreground">左</span>
          <select
            aria-label={`${title}左侧`}
            value={row.left}
            onChange={(event) => updateSlot("left", event.target.value as ChromeItem)}
            className="h-9 w-full rounded border bg-background px-2 text-xs outline-none focus:border-primary"
          >
            {ITEMS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-muted-foreground">中</span>
          <select
            aria-label={`${title}中间`}
            value={row.center}
            onChange={(event) => updateSlot("center", event.target.value as ChromeItem)}
            className="h-9 w-full rounded border bg-background px-2 text-xs outline-none focus:border-primary"
          >
            {ITEMS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-muted-foreground">右</span>
          <select
            aria-label={`${title}右侧`}
            value={row.right}
            onChange={(event) => updateSlot("right", event.target.value as ChromeItem)}
            className="h-9 w-full rounded border bg-background px-2 text-xs outline-none focus:border-primary"
          >
            {ITEMS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={row.showDivider}
          onChange={(event) => onChange({ ...row, showDivider: event.target.checked })}
        />
        显示分隔线
      </label>
    </div>
  );
}

export function ReaderChromePanel() {
  const { activeStyle, patchActiveStyle } = useReaderStore();

  return (
    <section className="space-y-4">
      <h3 className="text-xs font-medium text-muted-foreground">页眉 / 页脚</h3>
      <ChromeRowEditor
        title="页眉"
        row={activeStyle.header}
        onChange={(header) => patchActiveStyle({ header })}
      />
      <ChromeRowEditor
        title="页脚"
        row={activeStyle.footer}
        onChange={(footer) => patchActiveStyle({ footer })}
      />
    </section>
  );
}
