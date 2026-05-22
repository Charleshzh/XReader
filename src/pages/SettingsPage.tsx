import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Cloud, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface SyncConfig {
  enabled: boolean;
  backend_type: string;
  url: string;
  username: string;
  password: string;
  auto_sync_interval_minutes: number;
}

export function SettingsPage() {
  const [config, setConfig] = useState<SyncConfig>({
    enabled: false,
    backend_type: "webdav",
    url: "",
    username: "",
    password: "",
    auto_sync_interval_minutes: 30,
  });
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    invoke<SyncConfig>("get_sync_config")
      .then((c) => {
        if (c && Object.keys(c).length > 0) setConfig(c);
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await invoke("configure_sync", { config });
      setSyncResult({ type: "success", text: "配置已保存" });
    } catch (err) {
      setSyncResult({ type: "error", text: `保存失败: ${String(err)}` });
    }
    setSaving(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await invoke<{
        uploaded: number;
        downloaded: number;
        errors: string[];
      }>("sync_now");
      if (result.errors.length > 0) {
        setSyncResult({
          type: "error",
          text: result.errors.join("; "),
        });
      } else {
        setSyncResult({
          type: "success",
          text: `同步完成 — 上传 ${result.uploaded} 项`,
        });
      }
    } catch (err) {
      setSyncResult({ type: "error", text: `同步失败: ${String(err)}` });
    }
    setSyncing(false);
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center border-b px-6 py-4">
        <h1 className="text-2xl font-bold">设置</h1>
      </header>

      <main className="flex-1 overflow-auto p-6">
        {/* Sync section */}
        <div className="mb-8 max-w-lg rounded-lg border p-6">
          <div className="mb-4 flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            <h2 className="text-lg font-semibold">云同步 (WebDAV)</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            通过 WebDAV 协议将书架、进度、书签同步到云端（如坚果云、Nextcloud）
          </p>

          <div className="space-y-4">
            {/* Enable toggle */}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="h-4 w-4"
              />
              <span className="text-sm">启用云同步</span>
            </label>

            {config.enabled && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium">WebDAV 地址</label>
                  <input
                    type="text"
                    value={config.url}
                    onChange={(e) => setConfig({ ...config, url: e.target.value })}
                    placeholder="https://dav.jianguoyun.com/dav/xreader"
                    className="h-9 w-full rounded border bg-background px-3 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">用户名</label>
                  <input
                    type="text"
                    value={config.username}
                    onChange={(e) => setConfig({ ...config, username: e.target.value })}
                    className="h-9 w-full rounded border bg-background px-3 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">密码</label>
                  <input
                    type="password"
                    value={config.password}
                    onChange={(e) => setConfig({ ...config, password: e.target.value })}
                    className="h-9 w-full rounded border bg-background px-3 text-sm outline-none focus:border-primary"
                  />
                </div>
              </>
            )}
          </div>

          {syncResult && (
            <div
              className={`mt-4 flex items-center gap-2 rounded-md p-3 text-sm ${
                syncResult.type === "success"
                  ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                  : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
              }`}
            >
              {syncResult.type === "success" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              {syncResult.text}
            </div>
          )}

          <div className="mt-4 flex gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              保存配置
            </Button>
            {config.enabled && (
              <Button variant="outline" onClick={handleSync} disabled={syncing}>
                {syncing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Cloud className="mr-2 h-4 w-4" />
                )}
                立即同步
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
