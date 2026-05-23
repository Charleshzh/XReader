import { useState } from "react";
import { useReaderStore } from "@/stores/readerStore";
import { Button } from "@/components/ui/button";
import { X, BookmarkPlus, Trash2, Download } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

export function BookmarkPanel() {
  const { bookmarks, book, chapters, addBookmark, deleteBookmark, toggleBookmarks, loadChapter } =
    useReaderStore();
  const [label, setLabel] = useState("");

  const handleAdd = () => {
    const name = label.trim() || `书签 ${bookmarks.length + 1}`;
    void addBookmark(name);
    setLabel("");
  };

  const handleExport = async () => {
    const title = book?.title || "未知书名";
    const date = new Date().toISOString().slice(0, 10);
    const path = await save({
      defaultPath: `书签_${title}_${date}.md`,
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    if (!path) return;

    let md = `# 书签 — 《${title}》\n\n`;
    md += `导出日期: ${date}\n\n---\n\n`;
    for (const bm of bookmarks) {
      const chapterTitle = chapters[bm.chapter_index]?.title || `第${bm.chapter_index + 1}章`;
      md += `- **${chapterTitle}**: ${bm.label}\n`;
    }
    md += `\n共 ${bookmarks.length} 个书签\n`;

    await invoke("write_file", { path, content: md });
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-72 flex-col border-l bg-background shadow-xl">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">书签</h2>
        <Button variant="ghost" size="icon" onClick={toggleBookmarks}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex gap-2 border-b p-3">
        <input
          type="text"
          placeholder="书签名称（可选）"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="h-8 flex-1 rounded border px-2 text-xs outline-none focus:border-primary"
        />
        <Button size="sm" onClick={handleAdd}>
          <BookmarkPlus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        {bookmarks.length === 0 ? (
          <p className="p-4 text-center text-xs text-muted-foreground">暂无书签</p>
        ) : (
          bookmarks.map((bm) => (
            <div
              key={bm.id}
              className="flex items-center gap-2 border-b px-4 py-2.5 last:border-b-0"
            >
              <button
                onClick={() => {
                  void loadChapter(bm.chapter_index, bm.position);
                  toggleBookmarks();
                }}
                className="flex-1 text-left text-sm hover:text-primary"
              >
                <span className="line-clamp-1">{bm.label}</span>
                <span className="text-xs text-muted-foreground">第{bm.chapter_index + 1}章</span>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => deleteBookmark(bm.id)}
              >
                <Trash2 className="h-3 w-3 text-muted-foreground" />
              </Button>
            </div>
          ))
        )}
      </div>

      {bookmarks.length > 0 && (
        <div className="flex items-center justify-between border-t px-4 py-2">
          <span className="text-xs text-muted-foreground">共 {bookmarks.length} 个书签</span>
          <Button variant="ghost" size="sm" onClick={handleExport}>
            <Download className="mr-1 h-3 w-3" /> 导出
          </Button>
        </div>
      )}
    </div>
  );
}
