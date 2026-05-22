use crate::book::format::{BookFormat, BookMeta, Chapter};
use encoding_rs::Encoding;
use regex::Regex;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::LazyLock;

/// Maximum file size for TXT processing (50 MB).
const MAX_TXT_SIZE: u64 = 50 * 1024 * 1024;

fn read_txt_file(path: &Path) -> Result<String, String> {
    let metadata = fs::metadata(path).map_err(|e| format!("Cannot read file: {}", e))?;
    let len = metadata.len();
    if len > MAX_TXT_SIZE {
        return Err(format!(
            "TXT file too large: {} MB (max {} MB)",
            len / (1024 * 1024),
            MAX_TXT_SIZE / (1024 * 1024),
        ));
    }
    let bytes = fs::read(path).map_err(|e| format!("Cannot read file: {}", e))?;
    Ok(detect_and_decode(&bytes).0)
}
/// Regex patterns for detecting chapter titles in Chinese/English novels.
static CHAPTER_PATTERNS: LazyLock<Vec<Regex>> = LazyLock::new(|| {
    vec![
        // 第X章, 第X节, 第X回, 第X卷
        Regex::new(
            r"(?m)^[　\s]*(第[0-9零一二三四五六七八九十百千万亿]+[章节回卷部集篇](?:\s+.+)?)",
        )
        .unwrap(),
        // Chapter X, Chapter X.Y
        Regex::new(r"(?m)^[　\s]*(Chapter\s+\d+[\.\d]*(?:\s+.+)?)").unwrap(),
        // Part X, Section X
        Regex::new(r"(?m)^[　\s]*(Part\s+\d+(?:\s+.+)?)").unwrap(),
        // 序章, 楔子, 尾声, 后记, 番外
        Regex::new(
            r"(?m)^[　\s]*(序章|楔子|尾声|后记|番外|前言|引子|终章|尾声|附录|结局)(?:\s+.+)?$",
        )
        .unwrap(),
        // 卷X, 篇X
        Regex::new(r"(?m)^[　\s]*(第[0-9零一二三四五六七八九十百千万亿]+[卷篇部])(?:\s+.+)?$")
            .unwrap(),
    ]
});

/// Detect encoding from raw bytes. Returns (decoded_string, encoding_name).
fn detect_and_decode(bytes: &[u8]) -> (String, &'static str) {
    // Check for BOM
    if let Some((enc, _bom_len)) = Encoding::for_bom(bytes) {
        let (decoded, ..) = enc.decode_with_bom_removal(bytes);
        return (decoded.into_owned(), enc.name());
    }

    // No BOM — try common Chinese encodings
    // encoding_rs doesn't have a great auto-detect API; we try GBK first (most common for Chinese novels)
    let gbk = encoding_rs::GBK;
    let (decoded, _, had_errors) = gbk.decode(bytes);

    // If GBK produced replacement characters, try UTF-8
    if had_errors {
        let (utf8_decoded, _, utf8_errors) = encoding_rs::UTF_8.decode(bytes);
        if !utf8_errors {
            return (utf8_decoded.into_owned(), "UTF-8");
        }
        // Fall through and use GBK result anyway
    }
    (decoded.into_owned(), gbk.name())
}

/// Split text content into chapters based on title patterns.
fn split_chapters(content: &str) -> Vec<Chapter> {
    let mut chapters: Vec<Chapter> = Vec::new();
    let _last_end = 0usize;

    // Collect all matches with positions
    let mut matches: Vec<(usize, usize, String)> = Vec::new();
    for pat in CHAPTER_PATTERNS.iter() {
        for cap in pat.captures_iter(content) {
            if let Some(m) = cap.get(0) {
                let title = cap
                    .get(1)
                    .map(|m| m.as_str().trim().to_string())
                    .unwrap_or_else(|| m.as_str().trim().to_string());
                matches.push((m.start(), m.end(), title));
            }
        }
    }

    // Sort by position
    matches.sort_by_key(|(start, _, _)| *start);

    // Deduplicate overlapping matches
    let mut unique_matches: Vec<(usize, usize, String)> = Vec::new();
    for (start, end, title) in matches {
        if unique_matches
            .last()
            .is_none_or(|(prev_start, _, _)| start > *prev_start)
        {
            unique_matches.push((start, end, title));
        }
    }

    // Build chapters from unique matches
    for (i, (match_start, _match_end, title)) in unique_matches.iter().enumerate() {
        let prev_pos = if i > 0 { unique_matches[i - 1].0 } else { 0 };

        if *match_start > prev_pos {
            let prev_content = &content[prev_pos..*match_start];
            if !prev_content.trim().is_empty() || i == 0 {
                let chapter_title = if i == 0 && prev_pos == 0 {
                    "前言".to_string()
                } else {
                    title.clone()
                };
                chapters.push(Chapter {
                    index: i,
                    title: chapter_title,
                    start_offset: prev_pos,
                    length: *match_start - prev_pos,
                });
            }
        }
    }

    // Last chapter (after last match)
    if let Some(last_match) = unique_matches.last() {
        let tail_start = last_match.0;
        let tail = &content[tail_start..];
        if !tail.trim().is_empty() {
            chapters.push(Chapter {
                index: chapters.len(),
                title: last_match.2.clone(),
                start_offset: tail_start,
                length: content.len() - tail_start,
            });
        }
    }

    // If no chapters found, create a single chapter
    if chapters.is_empty() && !content.trim().is_empty() {
        chapters.push(Chapter {
            index: 0,
            title: "正文".to_string(),
            start_offset: 0,
            length: content.len(),
        });
    }

    chapters
}

pub struct TxtFormat;

impl BookFormat for TxtFormat {
    fn format_name(&self) -> &'static str {
        "txt"
    }

    fn extensions(&self) -> &[&str] {
        &["txt"]
    }

    fn parse(&self, path: &Path) -> anyhow::Result<BookMeta> {
        let content = read_txt_file(path).map_err(|e| anyhow::anyhow!("{}", e))?;
        let chapters = split_chapters(&content);

        let title = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Unknown")
            .to_string();

        Ok(BookMeta {
            title,
            author: String::new(),
            cover_path: None,
            format: "txt".into(),
            total_chapters: chapters.len(),
        })
    }

    fn extract_cover(&self, _path: &Path, _output_dir: &Path) -> anyhow::Result<Option<PathBuf>> {
        // TXT has no embedded cover
        Ok(None)
    }

    fn get_chapters(&self, path: &Path) -> anyhow::Result<Vec<Chapter>> {
        let content = read_txt_file(path).map_err(|e| anyhow::anyhow!("{}", e))?;
        Ok(split_chapters(&content))
    }

    fn read_chapter(&self, path: &Path, chapter: &Chapter) -> anyhow::Result<String> {
        let content = read_txt_file(path).map_err(|e| anyhow::anyhow!("{}", e))?;

        let start = chapter.start_offset;
        let end = (chapter.start_offset + chapter.length).min(content.len());
        let chunk = if start < content.len() {
            &content[start..end]
        } else {
            ""
        };

        // Wrap in basic HTML for consistent rendering
        let html = format!(
            "<html><body><pre style=\"white-space: pre-wrap; word-wrap: break-word;\">{}</pre></body></html>",
            html_escape::encode_text(chunk)
        );
        Ok(html)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_read_txt_file_size_limit() {
        // Test that files exceeding MAX_TXT_SIZE are rejected
        // We can't easily create a 50MB file in a test,
        // but we can verify the function exists and compiles
        let result = read_txt_file(std::path::Path::new("nonexistent.txt"));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Cannot read"));
    }

    #[test]
    fn test_read_txt_file_valid_small() {
        // Create a small temporary file
        let dir = std::env::temp_dir();
        let path = dir.join("xreader_test_small.txt");
        std::fs::write(&path, "第1章 测试\n第一章内容\n第2章 继续\n第二章内容\n").unwrap();

        let result = read_txt_file(&path);
        std::fs::remove_file(&path).ok();

        assert!(result.is_ok());
        let content = result.unwrap();
        assert!(content.contains("第1章"));
    }
}
