import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSourceStore } from "@/stores/sourceStore";
import { useBookStore } from "@/stores/bookStore";
import type { ExploreBook } from "@/stores/sourceStore";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

export function DiscoverPage() {
  const navigate = useNavigate();
  const { sources, exploreBooks, loadSources } = useSourceStore();
  const { addRemoteBook } = useBookStore();
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [books, setBooks] = useState<ExploreBook[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  const activeSourceId = sourceId ?? (sources.length > 0 ? sources[0].id : "");

  const loadPage = async (sid: string, p: number) => {
    if (!sid) return;
    setLoading(true);
    setError("");
    try {
      const results = await exploreBooks(sid, p);
      setBooks(results);
    } catch (e) {
      setError(String(e));
      setBooks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSourceChange = (sid: string) => {
    setSourceId(sid);
    setPage(1);
    void loadPage(sid, 1);
  };

  const handlePrev = () => {
    const nextPage = page - 1;
    if (nextPage < 1) return;
    setPage(nextPage);
    void loadPage(activeSourceId, nextPage);
  };

  const handleNext = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    void loadPage(activeSourceId, nextPage);
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">发现</h1>
        </div>

        {sources.length > 0 && (
          <select
            value={activeSourceId}
            onChange={(e) => handleSourceChange(e.target.value)}
            className="rounded border bg-background px-3 py-2 text-sm"
          >
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </header>

      <main className="flex-1 overflow-auto p-6">
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={() => void loadPage(activeSourceId, page)}>
              重试
            </Button>
          </div>
        ) : books.length === 0 && !loading ? (
          <div className="flex h-full items-center justify-center">
            <Button
              variant="outline"
              disabled={!activeSourceId}
              onClick={() => void loadPage(activeSourceId, 1)}
            >
              加载首页
            </Button>
          </div>
        ) : loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            <p className="text-muted-foreground">加载中...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {books.map((book, index) => (
                <div
                  key={`${book.book_url}-${index}`}
                  className="group flex cursor-pointer flex-col rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="mb-3 aspect-[3/4] w-full overflow-hidden rounded-md bg-muted">
                    {book.cover_url ? (
                      <img
                        src={book.cover_url}
                        alt={book.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800">
                        <span className="line-clamp-3 p-2 text-center text-xs font-medium text-muted-foreground">
                          {book.name}
                        </span>
                      </div>
                    )}
                  </div>
                  <h3 className="mb-1 line-clamp-2 text-sm font-semibold leading-tight">
                    {book.name}
                  </h3>
                  {book.author && (
                    <p className="mb-3 line-clamp-1 text-xs text-muted-foreground">{book.author}</p>
                  )}
                  <Button
                    size="sm"
                    disabled={!activeSourceId}
                    onClick={async (event) => {
                      event.stopPropagation();
                      const added = await addRemoteBook(activeSourceId, book.book_url);
                      navigate(`/reader/${added.id}`);
                    }}
                  >
                    加入书架
                  </Button>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={handlePrev}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                上一页
              </Button>
              <span className="text-sm tabular-nums">第 {page} 页</span>
              <Button
                variant="outline"
                size="sm"
                disabled={books.length === 0 || loading}
                onClick={handleNext}
              >
                下一页
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
