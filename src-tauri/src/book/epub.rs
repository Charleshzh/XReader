use crate::book::format::{BookFormat, BookMeta, Chapter};
use anyhow::Context;
use std::fs;
use std::io::BufReader;
use std::path::{Path, PathBuf};

pub struct EpubFormat;

impl BookFormat for EpubFormat {
    fn format_name(&self) -> &'static str {
        "epub"
    }

    fn extensions(&self) -> &[&str] {
        &["epub"]
    }

    fn parse(&self, path: &Path) -> anyhow::Result<BookMeta> {
        let file = fs::File::open(path)
            .with_context(|| format!("Cannot open EPUB: {}", path.display()))?;
        let reader = BufReader::new(file);
        let doc = epub::doc::EpubDoc::from_reader(reader)
            .context("Failed to parse EPUB document")?;

        let title = doc.mdata("title").map(|m| m.value.clone()).unwrap_or_else(|| {
            path.file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Unknown")
                .to_string()
        });
        let author = doc
            .mdata("creator")
            .map(|m| m.value.clone())
            .unwrap_or_default();

        let total_chapters = doc.spine.len();

        Ok(BookMeta {
            title,
            author,
            cover_path: None,
            format: "epub".into(),
            total_chapters,
        })
    }

    fn extract_cover(&self, path: &Path, output_dir: &Path) -> anyhow::Result<Option<PathBuf>> {
        let file = fs::File::open(path)?;
        let reader = BufReader::new(file);
        let mut doc = epub::doc::EpubDoc::from_reader(reader)?;

        if let Some((data, mime)) = doc.get_cover() {
            let ext = mime_to_ext(&mime);
            let cover_path = output_dir.join(format!("cover.{}", ext));
            fs::write(&cover_path, &data)?;
            Ok(Some(cover_path))
        } else {
            Ok(None)
        }
    }

    fn get_chapters(&self, path: &Path) -> anyhow::Result<Vec<Chapter>> {
        let file = fs::File::open(path)?;
        let reader = BufReader::new(file);
        let doc = epub::doc::EpubDoc::from_reader(reader)?;

        let chapters: Vec<Chapter> = doc
            .spine
            .iter()
            .enumerate()
            .map(|(i, _)| Chapter {
                index: i,
                title: format!("Chapter {}", i + 1),
                start_offset: 0,
                length: 0,
            })
            .collect();
        Ok(chapters)
    }

    fn read_chapter(&self, path: &Path, chapter: &Chapter) -> anyhow::Result<String> {
        let file = fs::File::open(path)?;
        let reader = BufReader::new(file);
        let mut doc = epub::doc::EpubDoc::from_reader(reader)?;

        let spine_id = doc
            .spine
            .get(chapter.index)
            .ok_or_else(|| anyhow::anyhow!("Chapter index {} out of bounds", chapter.index))?
            .idref
            .clone();

        let (content, _mime) = doc
            .get_resource(&spine_id)
            .with_context(|| format!("Failed to read chapter {}", chapter.index))?;

        Ok(String::from_utf8_lossy(&content).to_string())
    }
}

fn mime_to_ext(mime: &str) -> &str {
    match mime {
        "image/jpeg" => "jpg",
        "image/png" => "png",
        "image/gif" => "gif",
        "image/webp" => "webp",
        "image/svg+xml" => "svg",
        _ => "jpg",
    }
}
