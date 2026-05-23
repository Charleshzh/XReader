import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useReaderStore } from "@/stores/readerStore";

export function ReaderSearchPanel() {
  const {
    searchQuery,
    setSearchQuery,
    searchMatches,
    currentSearchIndex,
    jumpToSearchMatch,
    closeSearchPanel,
  } = useReaderStore();
  const [value, setValue] = useState(searchQuery);

  return (
    <div className="fixed inset-x-0 top-12 z-40 border-b bg-background p-3 shadow">
      <div className="flex gap-2">
        <input
          className="h-9 flex-1 rounded border px-3 text-sm"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="搜索正文..."
        />
        <Button size="sm" variant="outline" onClick={() => setSearchQuery(value)}>
          搜索
        </Button>
        <Button size="sm" variant="outline" onClick={closeSearchPanel}>
          关闭
        </Button>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {searchMatches.length > 0
            ? `第 ${currentSearchIndex + 1} / ${searchMatches.length} 个结果`
            : "无结果"}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={searchMatches.length === 0}
            onClick={() => jumpToSearchMatch(currentSearchIndex - 1)}
          >
            上一处
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={searchMatches.length === 0}
            onClick={() => jumpToSearchMatch(currentSearchIndex + 1)}
          >
            下一处
          </Button>
        </div>
      </div>
    </div>
  );
}
