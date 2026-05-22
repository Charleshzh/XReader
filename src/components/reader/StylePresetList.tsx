import { useReaderStore } from "@/stores/readerStore";
import { Button } from "@/components/ui/button";

export function StylePresetList() {
  const { settingsState, selectStylePreset, createStylePreset, deleteStylePreset } = useReaderStore();

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground">样式预设</h3>
        <Button size="sm" variant="outline" onClick={() => createStylePreset("新样式")}>
          新增
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {settingsState.styles.map((style) => (
          <button
            key={style.id}
            type="button"
            aria-label={style.name}
            aria-pressed={settingsState.activeStyleId === style.id}
            className={`rounded-lg border p-3 text-left transition-colors ${settingsState.activeStyleId === style.id ? "border-primary bg-accent" : "border-border hover:bg-accent"}`}
            onClick={() => selectStylePreset(style.id)}
          >
            <div className="font-medium">{style.name}</div>
            <div aria-hidden="true" className="text-xs text-muted-foreground">
              {style.theme} · {style.fontSize}px
            </div>
          </button>
        ))}
      </div>

      {settingsState.styles.length > 1 ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => deleteStylePreset(settingsState.activeStyleId)}
        >
          删除当前样式
        </Button>
      ) : null}
    </section>
  );
}
