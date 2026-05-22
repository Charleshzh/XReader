import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useReaderStore } from "@/stores/readerStore";
import { useBookStore } from "@/stores/bookStore";
import { ReaderShell } from "@/components/reader/ReaderShell";
import { HtmlContentView } from "@/components/reader/HtmlContentView";
import { PdfContentView } from "@/components/reader/PdfContentView";
import { ChapterTOC } from "@/components/reader/ChapterTOC";
import { ReaderSettings } from "@/components/reader/ReaderSettings";
import { BookmarkPanel } from "@/components/reader/BookmarkPanel";
import { AnnotationPanel } from "@/components/reader/AnnotationPanel";
import { Loader2 } from "lucide-react";

export function ReaderPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const {
    book,
    content,
    loading,
    currentChapter,
    chapters,
    tocOpen,
    settingsOpen,
    bookmarksOpen,
    annotationsOpen,
  } = useReaderStore();
  const { books, loaded, loadBooks } = useBookStore();

  useEffect(() => {
    if (!bookId) return;
    if (!loaded) {
      void loadBooks();
      return;
    }

    const target = books.find((candidate) => candidate.id === bookId);
    if (target) {
      void useReaderStore.getState().openBook(target);
      return;
    }

    navigate("/", { replace: true });
  }, [bookId, books, loaded, loadBooks, navigate]);

  if (!loaded || !book) {
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

      {tocOpen && <ChapterTOC />}
      {settingsOpen && <ReaderSettings />}
      {bookmarksOpen && <BookmarkPanel />}
      {annotationsOpen && <AnnotationPanel />}
    </div>
  );
}
