import { useEffect, useState } from "react";
import { useSourceStore } from "@/stores/sourceStore";
import { Button } from "@/components/ui/button";
import { Trash2, Upload } from "lucide-react";

export function SourceManagePage() {
  const { sources, loading, loadSources, importSource, deleteSource } = useSourceStore();
  const [importText, setImportText] = useState("");

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  const handleImport = () => {
    if (!importText.trim()) return;
    importSource(importText);
    setImportText("");
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-2xl font-bold">书源管理</h1>
      </header>

      <main className="flex-1 overflow-auto p-6">
        {/* Import section */}
        <div className="mb-6 rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-semibold">导入书源</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            粘贴 Legado 书源 JSON 文本，支持 .txt / .json 格式
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='{"bookSourceUrl": "https://...", "bookSourceName": "...", "ruleSearch": {...}}'
            className="mb-3 h-32 w-full resize-none rounded border bg-background p-3 text-xs font-mono outline-none focus:border-primary"
          />
          <Button onClick={handleImport} disabled={!importText.trim()}>
            <Upload className="mr-2 h-4 w-4" />
            导入
          </Button>
        </div>

        {/* Source list */}
        <h2 className="mb-3 text-sm font-semibold">
          已导入书源 ({sources.length})
        </h2>

        {loading ? (
          <p className="text-sm text-muted-foreground">加载中...</p>
        ) : sources.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无书源，请在上方粘贴 JSON 导入</p>
        ) : (
          <div className="space-y-2">
            {sources.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <div className="flex-1">
                  <p className="font-medium text-sm">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.base_url}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteSource(s.id)}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
