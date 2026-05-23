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
        let doc =
            epub::doc::EpubDoc::from_reader(reader).context("Failed to parse EPUB document")?;

        let title = doc
            .mdata("title")
            .map(|m| m.value.clone())
            .unwrap_or_else(|| {
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;
    use tempfile::tempdir;
    use zip::write::SimpleFileOptions;

    fn write_minimal_epub(path: &std::path::Path) {
        let file = File::create(path).unwrap();
        let mut zip = zip::ZipWriter::new(file);
        let stored =
            SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
        let deflated =
            SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

        zip.start_file("mimetype", stored).unwrap();
        zip.write_all(b"application/epub+zip").unwrap();

        zip.add_directory("META-INF/", deflated).unwrap();
        zip.start_file("META-INF/container.xml", deflated).unwrap();
        zip.write_all(r#"<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>"#.as_bytes()).unwrap();

        zip.add_directory("OEBPS/", deflated).unwrap();
        zip.start_file("OEBPS/toc.ncx", deflated).unwrap();
        zip.write_all(r#"<?xml version="1.0" encoding="UTF-8"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head></head><docTitle><text>测试 EPUB</text></docTitle><navMap><navPoint id="navPoint-1" playOrder="1"><navLabel><text>Chapter 1</text></navLabel><content src="chapter1.xhtml"/></navPoint></navMap></ncx>"#.as_bytes()).unwrap();
        zip.start_file("OEBPS/content.opf", deflated).unwrap();
        zip.write_all(r#"<?xml version="1.0" encoding="utf-8"?><package version="2.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>测试 EPUB</dc:title><dc:creator>测试作者</dc:creator><dc:identifier id="bookid">bookid</dc:identifier></metadata><manifest><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/></manifest><spine toc="ncx"><itemref idref="chapter1"/></spine></package>"#.as_bytes()).unwrap();
        zip.start_file("OEBPS/chapter1.xhtml", deflated).unwrap();
        zip.write_all(
            r#"<html xmlns="http://www.w3.org/1999/xhtml"><body><p>第一章正文</p></body></html>"#
                .as_bytes(),
        )
        .unwrap();

        zip.finish().unwrap();
    }

    #[test]
    fn test_parse_minimal_epub_metadata() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("minimal.epub");
        write_minimal_epub(&path);

        let meta = EpubFormat.parse(&path).unwrap();
        assert_eq!(meta.title, "测试 EPUB");
        assert_eq!(meta.author, "测试作者");
        assert_eq!(meta.total_chapters, 1);
    }

    #[test]
    fn test_invalid_epub_returns_error() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("broken.epub");
        std::fs::write(&path, b"not a zip").unwrap();

        let err = EpubFormat.parse(&path).unwrap_err().to_string();
        assert!(err.contains("Failed to parse EPUB") || err.contains("Cannot open EPUB"));
    }
}
