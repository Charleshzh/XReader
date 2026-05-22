/** Matches Rust BookListItem serialization */
export interface BookItem {
  id: string;
  title: string;
  author: string;
  cover_path: string;
  format: "epub" | "txt" | "pdf" | "remote";
  file_path: string;
  total_chapters: number;
  updated_at: number;
  source_type: "local" | "remote";
  source_id: string;
  source_url: string;
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
