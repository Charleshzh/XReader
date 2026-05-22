pub mod epub;
pub mod format;
pub mod pdf;
pub mod txt;

pub use epub::EpubFormat;
pub use format::{BookFormat, BookMeta, Chapter, FormatRegistry};
pub use pdf::PdfFormat;
pub use txt::TxtFormat;

use std::path::Path;

/// Create a FormatRegistry pre-loaded with all supported formats.
pub fn create_registry() -> FormatRegistry {
    let mut registry = FormatRegistry::new();
    registry.register(Box::new(EpubFormat));
    registry.register(Box::new(TxtFormat));
    registry.register(Box::new(PdfFormat));
    registry
}

/// Determine the format string ("epub", "txt", "pdf") from a file path.
pub fn detect_format(path: &Path) -> Option<String> {
    let ext = path.extension()?.to_str()?.to_lowercase();
    match ext.as_str() {
        "epub" => Some("epub".into()),
        "txt" => Some("txt".into()),
        "pdf" => Some("pdf".into()),
        _ => None,
    }
}
