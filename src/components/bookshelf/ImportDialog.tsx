import { useState } from "react";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { useBookStore } from "@/stores/bookStore";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, CheckCircle2, AlertCircle } from "lucide-react";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const importBook = useBookStore((s) => s.importBook);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  if (!open) return null;

  const handleImport = async () => {
    setMessage(null);
    const selected = await openFileDialog({
      multiple: true,
      filters: [
        {
          name: "Books",
          extensions: ["epub", "txt", "pdf"],
        },
      ],
    });

    if (!selected) return;

    // selected is string[] | null when multiple: true
    const files: string[] = Array.isArray(selected)
      ? selected
      : [selected as unknown as string];
    setImporting(true);

    for (const filePath of files) {
      try {
        const result = await importBook(filePath);
        setMessage({ type: "success", text: `已导入: ${result.title}` });
      } catch (err) {
        setMessage({
          type: "error",
          text: `导入失败: ${String(err)}`,
        });
        break;
      }
    }
    setImporting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">导入书籍</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          支持 EPUB、TXT、PDF 格式。可一次选择多个文件。
        </p>

        {message && (
          <div
            className={`mb-4 flex items-center gap-2 rounded-md p-3 text-sm ${
              message.type === "success"
                ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {message.text}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={importing}
          >
            取消
          </Button>
          <Button onClick={handleImport} disabled={importing}>
            {importing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                导入中...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                选择文件
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
