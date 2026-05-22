import { useState, useEffect } from "react";
import { useSourceStore } from "@/stores/sourceStore";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";

export function SearchPage() {
  const { sources, searchResults, searching, loadSources, searchBooks } =
    useSourceStore();
  const [keyword, setKeyword] = useState("");
  const [sourceId, setSourceId] = useState("");

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  useEffect(() => {
    if (sources.length > 0 && !sourceId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSourceId(sources[0].id);
    }
  }, [sources, sourceId]);

  const handleSearch = () => {
    if (!keyword.trim() || !sourceId) return;
    searchBooks(sourceId, keyword);
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-2xl font-bold">搜索书籍</h1>
      </header>

      <main className="flex-1 overflow-auto p-6">
        {/* Search bar */}
        <div className="mb-6 flex gap-3">
          <select
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            className="rounded border bg-background px-3 py-2 text-sm"
          >
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="输入书名或作者..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="h-10 flex-1 rounded border bg-background px-3 text-sm outline-none focus:border-primary"
          />
          <Button onClick={handleSearch} disabled={searching || !keyword.trim()}>
            {searching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            搜索
          </Button>
        </div>

        {/* Results */}
        {searchResults.length > 0 && (
          <div className="space-y-3">
            {searchResults.map((r, i) => (
              <div key={i} className="flex gap-4 rounded-lg border p-4">
                {r.cover_url && (
                  <img
                    src={r.cover_url}
                    alt={r.name}
                    className="h-24 w-16 shrink-0 rounded object-cover"
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-semibold">{r.name}</h3>
                  {r.author && (
                    <p className="text-sm text-muted-foreground">{r.author}</p>
                  )}
                  {r.intro && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {r.intro}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!searching && searchResults.length === 0 && (
          <div className="flex flex-col items-center gap-2 pt-20 text-muted-foreground">
            <Search className="h-10 w-10 opacity-30" />
            <p className="text-sm">输入关键词搜索网络小说</p>
          </div>
        )}
      </main>
    </div>
  );
}
