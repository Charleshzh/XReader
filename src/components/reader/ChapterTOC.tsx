import { useReaderStore } from "@/stores/readerStore";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ChapterTOC() {
  const { chapters, currentChapter, loadChapter, toggleToc } = useReaderStore();

  return (
    <div className="fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r bg-background shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">目录</h2>
        <Button variant="ghost" size="icon" onClick={toggleToc}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Chapter list */}
      <div className="flex-1 overflow-auto">
        {chapters.map((ch) => (
          <button
            key={ch.index}
            onClick={() => {
              loadChapter(ch.index);
              toggleToc();
            }}
            className={`w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-accent ${
              ch.index === currentChapter ? "bg-accent font-medium text-primary" : "text-foreground"
            }`}
          >
            <span className="line-clamp-1">{ch.title}</span>
          </button>
        ))}
      </div>

      {/* Footer: chapter count */}
      <div className="border-t px-4 py-2 text-xs text-muted-foreground">
        共 {chapters.length} 章
      </div>
    </div>
  );
}
