import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useReaderStore } from "@/stores/readerStore";
import { useBookStore } from "@/stores/bookStore";
import { ReaderShell } from "@/components/reader/ReaderShell";
import { HtmlContentView } from "@/components/reader/HtmlContentView";
import { PdfContentView } from "@/components/reader/PdfContentView";
import { ChapterTOC } from "@/components/reader/ChapterTOC";
import { ReaderSettings } from "@/components/reader/ReaderSettings";
import { Loader2 } from "lucide-react";

export function ReaderPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const { book, content, loading, currentChapter, chapters, tocOpen, settingsOpen } =
    useReaderStore();
  const books = useBookStore((s) => s.books);

  useEffect(() => {
    if (!bookId) return;
    const target = books.find((b) => b.id === bookId);
    if (target) {
      useReaderStore.getState().openBook(target);
    } else {
      navigate("/", { replace: true });
    }
  }, [bookId, books, navigate]);

  if (!book) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isPdf = book.format === "pdf";

  return (
    <div className="relative h-screen overflow-hidden bg-background">
      <ReaderShell
        title={book.title}
        chapterTitle={chapters[currentChapter]?.title || ""}
        onBack={() => navigate("/")}
      >
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : isPdf ? (
          <PdfContentView filePath={book.file_path} />
        ) : (
          <HtmlContentView content={content} />
        )}
      </ReaderShell>

      {/* TOC sidebar */}
      {tocOpen && <ChapterTOC />}

      {/* Settings panel */}
      {settingsOpen && <ReaderSettings />}
    </div>
  );
}
