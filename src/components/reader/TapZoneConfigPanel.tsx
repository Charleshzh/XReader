import { useReaderStore } from "@/stores/readerStore";
import type { TapAction, TapZone } from "@/types/reader";

const ZONES: TapZone[] = ["tl", "tc", "tr", "ml", "mc", "mr", "bl", "bc", "br"];
const ACTIONS: { value: TapAction; label: string }[] = [
  { value: "noop", label: "无" },
  { value: "menu", label: "菜单" },
  { value: "next-page", label: "下一页" },
  { value: "prev-page", label: "上一页" },
  { value: "next-chapter", label: "下一章" },
  { value: "prev-chapter", label: "上一章" },
  { value: "bookmark", label: "书签" },
  { value: "search", label: "搜索" },
  { value: "tts-toggle", label: "朗读" },
];

const AUTO_PAGE_OPTIONS = [
  { value: "", label: "关闭" },
  { value: "15", label: "15 秒" },
  { value: "30", label: "30 秒" },
  { value: "60", label: "60 秒" },
];

export function TapZoneConfigPanel() {
  const { settingsState, patchInteraction } = useReaderStore();

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-medium text-muted-foreground">点击区域</h3>

      <label className="block space-y-1 text-xs">
        <span className="text-muted-foreground">自动翻页</span>
        <select
          value={settingsState.interaction.autoPageSeconds ?? ""}
          onChange={(event) =>
            patchInteraction({
              autoPageSeconds: event.target.value ? Number(event.target.value) : null,
            })
          }
          className="h-9 w-full rounded border bg-background px-2 text-xs outline-none focus:border-primary"
        >
          {AUTO_PAGE_OPTIONS.map((option) => (
            <option key={option.value || "off"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-3 gap-2">
        {ZONES.map((zone) => (
          <label key={zone} className="flex flex-col gap-1 rounded border p-2 text-xs">
            <span className="font-medium uppercase">{zone}</span>
            <select
              value={settingsState.interaction.tapZones[zone]}
              onChange={(event) =>
                patchInteraction({
                  tapZones: {
                    ...settingsState.interaction.tapZones,
                    [zone]: event.target.value as TapAction,
                  },
                })
              }
              className="h-8 rounded border bg-background px-1 text-[11px] outline-none focus:border-primary"
            >
              {ACTIONS.map((action) => (
                <option key={action.value} value={action.value}>
                  {action.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </section>
  );
}
