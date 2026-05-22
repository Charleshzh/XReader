import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useBookStore } from "@/stores/bookStore";
import { BookCard } from "@/components/bookshelf/BookCard";
import { ImportDialog } from "@/components/bookshelf/ImportDialog";
import { LayoutGrid, List, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BookItem } from "@/types/book";

export function BookshelfPage() {
  const { books, loading, viewMode, loadBooks, deleteBook, setViewMode } = useBookStore();
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  const filtered = books.filter(
    (b) =>
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.author.toLowerCase().includes(search.toLowerCase()),
  );

  const handleOpen = (book: BookItem) => {
    navigate(`/reader/${book.id}`);
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-2xl font-bold">书架</h1>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="搜索书名或作者..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-56 rounded-md border bg-background pl-9 pr-8 text-sm outline-none focus:border-primary"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* View mode toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
          >
            {viewMode === "grid" ? (
              <List className="h-4 w-4" />
            ) : (
              <LayoutGrid className="h-4 w-4" />
            )}
          </Button>

          {/* Import button */}
          <Button onClick={() => setShowImport(true)}>
            <Plus className="mr-1 h-4 w-4" />
            导入
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto px-6 py-6">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground">加载中...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            {books.length === 0 ? (
              <>
                <BookIcon className="h-16 w-16 text-muted-foreground/50" />
                <p className="text-lg text-muted-foreground">书架为空</p>
                <p className="text-sm text-muted-foreground">点击"导入"按钮添加本地书籍</p>
                <Button onClick={() => setShowImport(true)}>
                  <Plus className="mr-1 h-4 w-4" />
                  导入第一本书
                </Button>
              </>
            ) : (
              <p className="text-muted-foreground">无匹配结果</p>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filtered.map((book) => (
              <BookCard key={book.id} book={book} onDelete={deleteBook} onOpen={handleOpen} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((book) => (
              <div
                key={book.id}
                className="flex cursor-pointer items-center gap-4 rounded-lg border p-3 transition-colors hover:bg-accent"
                onClick={() => handleOpen(book)}
              >
                <div className="flex h-12 w-9 items-center justify-center rounded bg-muted text-xs font-bold">
                  {book.format.toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{book.title}</p>
                  {book.author && <p className="text-sm text-muted-foreground">{book.author}</p>}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteBook(book.id);
                  }}
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Import dialog */}
      <ImportDialog open={showImport} onOpenChange={setShowImport} />
    </div>
  );
}

/** Simple book icon placeholder */
function BookIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </svg>
  );
}
