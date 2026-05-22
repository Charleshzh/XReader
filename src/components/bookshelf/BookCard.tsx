import type { BookItem } from "@/types/book";
import { convertFileSrc } from "@tauri-apps/api/core";
import { BookOpen, FileText, FileType, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BookCardProps {
  book: BookItem;
  onDelete: (id: string) => void;
  onOpen: (book: BookItem) => void;
}

const formatIcon = (format: string) => {
  switch (format) {
    case "epub":
      return <BookOpen className="h-4 w-4" />;
    case "txt":
      return <FileText className="h-4 w-4" />;
    case "pdf":
      return <FileType className="h-4 w-4" />;
    default:
      return <BookOpen className="h-4 w-4" />;
  }
};

const formatColor = (format: string) => {
  switch (format) {
    case "epub":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "txt":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "pdf":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

export function BookCard({ book, onDelete, onOpen }: BookCardProps) {
  const coverSrc = book.cover_path
    ? convertFileSrc(book.cover_path)
    : null;

  return (
    <div
      className="group relative flex cursor-pointer flex-col rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md"
      onClick={() => onOpen(book)}
    >
      {/* Cover or placeholder */}
      <div className="mb-3 aspect-[3/4] w-full overflow-hidden rounded-md bg-muted">
        {coverSrc ? (
          <img
            src={coverSrc}
            alt={book.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800">
            <span className="text-center text-sm font-medium text-muted-foreground p-2 line-clamp-4">
              {book.title}
            </span>
          </div>
        )}
      </div>

      {/* Title */}
      <h3 className="mb-1 line-clamp-2 text-sm font-semibold leading-tight">
        {book.title}
      </h3>

      {/* Author */}
      {book.author && (
        <p className="mb-2 line-clamp-1 text-xs text-muted-foreground">
          {book.author}
        </p>
      )}

      {/* Format badge + chapters */}
      <div className="mt-auto flex items-center justify-between">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${formatColor(book.format)}`}
        >
          {formatIcon(book.format)}
          {book.format.toUpperCase()}
        </span>
      </div>

      {/* Delete button (visible on hover) */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(book.id);
        }}
      >
        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
      </Button>
    </div>
  );
}
