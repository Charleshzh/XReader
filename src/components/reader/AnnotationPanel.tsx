import { useState } from "react";
import { useReaderStore } from "@/stores/readerStore";
import { Button } from "@/components/ui/button";
import { X, Trash2, Highlighter } from "lucide-react";

const COLORS = [
  { key: "yellow", class: "bg-yellow-200 dark:bg-yellow-800", label: "黄" },
  { key: "green", class: "bg-green-200 dark:bg-green-800", label: "绿" },
  { key: "blue", class: "bg-blue-200 dark:bg-blue-800", label: "蓝" },
  { key: "pink", class: "bg-pink-200 dark:bg-pink-800", label: "粉" },
  { key: "orange", class: "bg-orange-200 dark:bg-orange-800", label: "橙" },
];

export function AnnotationPanel() {
  const {
    annotations,
    selectedAnnotation,
    updateAnnotationNote,
    deleteAnnotation,
    selectAnnotation,
    toggleAnnotations,
  } = useReaderStore();

  const [editNote, setEditNote] = useState("");

  const handleSelect = (a: (typeof annotations)[0]) => {
    selectAnnotation(a);
    setEditNote(a.note);
  };

  const handleSaveNote = () => {
    if (selectedAnnotation) {
      updateAnnotationNote(selectedAnnotation.id, editNote);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-72 flex-col border-l bg-background shadow-xl">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">笔记</h2>
        <Button variant="ghost" size="icon" onClick={toggleAnnotations}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        {annotations.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-6 text-center text-xs text-muted-foreground">
            <Highlighter className="h-8 w-8 opacity-30" />
            <p>选中文本后点击高亮</p>
          </div>
        ) : (
          annotations.map((a) => (
            <div
              key={a.id}
              onClick={() => handleSelect(a)}
              className={`cursor-pointer border-b px-4 py-2.5 last:border-b-0 ${
                selectedAnnotation?.id === a.id ? "bg-accent" : ""
              }`}
            >
              <div className="mb-1 flex items-center gap-1.5">
                <span
                  className={`inline-block h-3 w-3 rounded-full ${
                    COLORS.find((c) => c.key === a.color)?.class || ""
                  }`}
                />
                <span className="line-clamp-2 text-xs">{a.text || "(空)"}</span>
              </div>
              {a.note && <p className="ml-4.5 text-xs text-muted-foreground">{a.note}</p>}
            </div>
          ))
        )}
      </div>

      {/* Note editor for selected annotation */}
      {selectedAnnotation && (
        <div className="border-t p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <span className="line-clamp-1 text-xs font-medium">
              {selectedAnnotation.text || "(空)"}
            </span>
          </div>
          <textarea
            value={editNote}
            onChange={(e) => setEditNote(e.target.value)}
            placeholder="添加笔记..."
            className="mb-2 h-16 w-full resize-none rounded border px-2 py-1 text-xs outline-none focus:border-primary"
          />
          <div className="flex justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                deleteAnnotation(selectedAnnotation.id);
                selectAnnotation(null);
              }}
            >
              <Trash2 className="mr-1 h-3 w-3" /> 删除
            </Button>
            <Button size="sm" onClick={handleSaveNote}>
              保存
            </Button>
          </div>
        </div>
      )}

      {annotations.length > 0 && (
        <div className="border-t px-4 py-2 text-xs text-muted-foreground">
          {annotations.length} 条笔记
        </div>
      )}
    </div>
  );
}
