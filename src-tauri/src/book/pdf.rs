use crate::book::format::{BookFormat, BookMeta, Chapter};
use std::path::{Path, PathBuf};

pub struct PdfFormat;

impl BookFormat for PdfFormat {
    fn format_name(&self) -> &'static str {
        "pdf"
    }

    fn extensions(&self) -> &[&str] {
        &["pdf"]
    }

    fn parse(&self, path: &Path) -> anyhow::Result<BookMeta> {
        let title = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Unknown")
            .to_string();

        Ok(BookMeta {
            title,
            author: String::new(),
            cover_path: None,
            format: "pdf".into(),
            total_chapters: 1,
        })
    }

    fn extract_cover(&self, _path: &Path, _output_dir: &Path) -> anyhow::Result<Option<PathBuf>> {
        Ok(None)
    }

    fn get_chapters(&self, _path: &Path) -> anyhow::Result<Vec<Chapter>> {
        Ok(vec![Chapter {
            index: 0,
            title: "正文".to_string(),
            start_offset: 0,
            length: 0,
        }])
    }

    fn read_chapter(&self, _path: &Path, _chapter: &Chapter) -> anyhow::Result<String> {
        Ok("<html><body><p>PDF content rendered by pdf.js</p></body></html>".to_string())
    }
}
