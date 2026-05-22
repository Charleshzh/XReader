use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Core metadata extracted from any book format.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookMeta {
    pub title: String,
    pub author: String,
    pub cover_path: Option<PathBuf>,
    pub format: String,
    pub total_chapters: usize,
}

/// A chapter within a book.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Chapter {
    pub index: usize,
    pub title: String,
    /// Start byte offset in the source file (TXT only).
    pub start_offset: usize,
    /// Length in bytes (TXT only).
    pub length: usize,
}

/// Every book format parser must implement this trait.
pub trait BookFormat: Send + Sync {
    /// Human-readable format name: "epub", "txt", "pdf".
    fn format_name(&self) -> &'static str;

    /// File extensions this format handles, e.g. ["epub"] or ["txt"].
    fn extensions(&self) -> &[&str];

    /// Extract metadata and chapter list from a file.
    fn parse(&self, path: &Path) -> anyhow::Result<BookMeta>;

    /// Extract cover image to `output_dir`, return path to the extracted image.
    fn extract_cover(&self, path: &Path, output_dir: &Path) -> anyhow::Result<Option<PathBuf>>;

    /// Return the chapter list (called after parse, or re-parsed).
    fn get_chapters(&self, path: &Path) -> anyhow::Result<Vec<Chapter>>;

    /// Read a single chapter's content as HTML string.
    fn read_chapter(&self, path: &Path, chapter: &Chapter) -> anyhow::Result<String>;
}

/// Registry that maps file extensions to format parsers.
pub struct FormatRegistry {
    by_ext: Vec<(Vec<String>, Box<dyn BookFormat>)>,
}

impl FormatRegistry {
    pub fn new() -> Self {
        Self { by_ext: Vec::new() }
    }

    pub fn register(&mut self, format: Box<dyn BookFormat>) {
        let exts: Vec<String> = format.extensions().iter().map(|e| e.to_string()).collect();
        self.by_ext.push((exts, format));
    }

    /// Find the parser for a given file path, based on its extension.
    pub fn find_for(&self, path: &Path) -> Option<&dyn BookFormat> {
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase());
        let ext = ext.as_deref().unwrap_or("");
        for (exts, fmt) in &self.by_ext {
            if exts.iter().any(|e| e == ext) {
                return Some(fmt.as_ref());
            }
        }
        None
    }
}
