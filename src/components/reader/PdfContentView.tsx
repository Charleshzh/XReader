import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useReaderStore } from "@/stores/readerStore";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url,
).toString();

interface PdfContentViewProps {
  filePath: string;
}

export function PdfContentView({ filePath }: PdfContentViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { settings } = useReaderStore();

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const assetUrl = convertFileSrc(filePath);
        const loadingTask = pdfjsLib.getDocument({ url: assetUrl });
        const doc = await loadingTask.promise;
        if (cancelled) return;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setPageNum(1);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(`PDF 加载失败: ${String(err)}`);
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [filePath]);

  useEffect(() => {
    const doc = pdfDoc;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;

    let cancelled = false;
    (async () => {
      const page = await doc.getPage(pageNum);
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      const ctx = canvas.getContext("2d")!;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await page.render({ canvasContext: ctx, viewport } as any).promise;
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pageNum, scale]);

  const prevPage = () => setPageNum((p) => Math.max(1, p - 1));
  const nextPage = () => setPageNum((p) => Math.min(totalPages, p + 1));
  const zoomIn = () => setScale((s) => Math.min(3, s + 0.2));
  const zoomOut = () => setScale((s) => Math.max(0.5, s - 0.2));

  const bgClass = {
    light: "bg-gray-100",
    dark: "bg-gray-800",
    sepia: "bg-amber-100",
  }[settings.theme];

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">加载 PDF...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className={`flex h-full flex-col ${bgClass}`}>
      <div className="flex shrink-0 items-center justify-center gap-2 py-2">
        <Button variant="ghost" size="icon" onClick={zoomOut}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground">
          {Math.round(scale * 100)}%
        </span>
        <Button variant="ghost" size="icon" onClick={zoomIn}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <span className="mx-3 text-sm">
          {pageNum} / {totalPages}
        </span>
        <Button variant="ghost" size="icon" onClick={prevPage} disabled={pageNum <= 1}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={nextPage} disabled={pageNum >= totalPages}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-1 justify-center overflow-auto">
        <canvas ref={canvasRef} className="shadow-lg" />
      </div>
    </div>
  );
}
