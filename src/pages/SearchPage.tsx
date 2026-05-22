import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSourceStore } from "@/stores/sourceStore";
import { useBookStore } from "@/stores/bookStore";
import { Button } from "@/components/ui/button";
import { Search, Loader2, ArrowLeft } from "lucide-react";

export function SearchPage() {
  const navigate = useNavigate();
  const { sources, searchResults, searching, loadSources, searchBooks } = useSourceStore();
  const { addRemoteBook } = useBookStore();
  const [keyword, setKeyword] = useState("");
  const [sourceId, setSourceId] = useState("");

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  const activeSourceId = sourceId || sources[0]?.id || "";

  const handleSearch = () => {
    if (!keyword.trim() || !activeSourceId) return;
    void searchBooks(activeSourceId, keyword);
  };


  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">搜索书籍</h1>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6 flex gap-3">
          <select
            value={activeSourceId}
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

        {searchResults.length > 0 && (
          <div className="space-y-3">
            {searchResults.map((result, index) => (
              <div key={`${result.book_url}-${index}`} className="flex gap-4 rounded-lg border p-4">
                {result.cover_url && (
                  <img
                    src={result.cover_url}
                    alt={result.name}
                    className="h-24 w-16 shrink-0 rounded object-cover"
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-semibold">{result.name}</h3>
                  {result.author && (
                    <p className="text-sm text-muted-foreground">{result.author}</p>
                  )}
                  {result.intro && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{result.intro}</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  disabled={!activeSourceId}
                  onClick={async () => {
                    const added = await addRemoteBook(activeSourceId, result.book_url);
                    navigate(`/reader/${added.id}`);
                  }}
                >
                  加入书架
                </Button>
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
