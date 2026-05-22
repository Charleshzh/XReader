import { useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { useReaderStore } from "@/stores/readerStore";
import type { ReaderBundle } from "@/types/readerBundle";
import { isReaderBundle } from "@/types/readerBundle";

export function ReaderBundleButtons() {
  const { settingsState, replaceSettingsState } = useReaderStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const exportBundle = async () => {
    const path = await save({
      defaultPath: `xreader-reader-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return;

    const bundle: ReaderBundle = {
      kind: "xreader-reader-bundle",
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: settingsState,
      extensions: {},
    };

    await invoke("write_file", {
      path,
      content: JSON.stringify(bundle, null, 2),
    });
  };

  const importBundle = async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!isReaderBundle(parsed)) {
      throw new Error("Invalid XReader reader bundle");
    }
    replaceSettingsState(parsed.settings);
  };

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-medium text-muted-foreground">导入 / 导出</h3>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => void exportBundle()}>
          导出配置包
        </Button>
        <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
          导入配置包
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void importBundle(file);
          }
          event.currentTarget.value = "";
        }}
      />
    </section>
  );
}
