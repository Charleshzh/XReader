/** Matches Rust BookListItem serialization */
export interface BookItem {
  id: string;
  title: string;
  author: string;
  cover_path: string;
  format: "epub" | "txt" | "pdf";
  file_path: string;
  total_chapters: number;
  updated_at: number;
}

/** Returned from import_book command */
export interface ImportResult {
  id: string;
  title: string;
  author: string;
  cover_path: string;
  format: string;
  total_chapters: number;
  message: string;
}

export type ViewMode = "grid" | "list";
