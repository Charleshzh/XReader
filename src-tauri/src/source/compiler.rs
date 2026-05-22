//! RuleCompiler: parses tokenized rule strings into CompiledRule AST.

use super::tokenizer::{self, Token};
use super::types::*;

/// Parse a single segment string like "class.title.0" or "text" into a RuleSegment.
fn parse_segment(raw: &str) -> RuleSegment {
    // Extraction attributes that can appear as the last segment
    const EXTRACT_ATTRS: &[&str] = &[
        "text", "textNodes", "ownText", "href", "src", "html", "all",
    ];

    // Check if this is a bare extraction attribute
    if EXTRACT_ATTRS.contains(&raw) {
        return RuleSegment {
            selector_type: "_extract".into(),
            value: raw.to_string(),
            index: None,
        };
    }

    // Split by . — format is type.value.index
    let parts: Vec<&str> = raw.splitn(3, '.').collect();

    let selector_type = parts.first().map(|s| s.to_string()).unwrap_or_default();

    // Special case: "children" has no value
    if selector_type == "children" {
        return RuleSegment {
            selector_type,
            value: String::new(),
            index: None,
        };
    }

    // For xpath and json, the value may contain dots — use everything after the first dot
    let value = if matches!(selector_type.as_str(), "xpath" | "json" | "css") {
        // Everything after "xpath." / "json." / "css."
        raw[raw.find('.').map(|i| i + 1).unwrap_or(raw.len())..].to_string()
    } else if parts.len() >= 3 {
        // type.value.index
        parts[1].to_string()
    } else if parts.len() == 2 {
        parts[1].to_string()
    } else {
        String::new()
    };

    // Parse index (last part if numeric)
    let index = parts.last().and_then(|p| p.parse::<usize>().ok());

    // For xpath/json/css, the "index" is actually part of the value, not an index
    let index = if matches!(selector_type.as_str(), "xpath" | "json" | "css") {
        None
    } else {
        index
    };

    RuleSegment {
        selector_type,
        value,
        index,
    }
}

/// Parse a JS extraction segment: @js:expression
fn parse_js_extract(raw: &str) -> Option<String> {
    raw.strip_prefix("js:").map(|s| s.to_string())
}

/// Compile a list of tokens that belong to one alternative (no || separators).
fn compile_one_alternative(tokens: &[Token]) -> CompiledRule {
    let mut segments: Vec<RuleSegment> = Vec::new();
    let mut extract_attr: Option<String> = None;
    let mut js_extract: Option<String> = None;
    let mut comment: Option<String> = None;

    for token in tokens {
        match token {
            Token::Segment(raw) => {
                // Check for JS extraction @js:expression
                if raw.starts_with("js:") {
                    js_extract = Some(raw[3..].to_string());
                    continue;
                }

                let seg = parse_segment(raw);
                // If the segment type is "_extract", it's an extraction attribute
                if seg.selector_type == "_extract" {
                    // Check if this is a JS extraction
                    if let Some(js) = parse_js_extract(raw) {
                        js_extract = Some(js);
                    } else {
                        extract_attr = Some(seg.value);
                    }
                } else {
                    segments.push(seg);
                }
            }
            Token::Comment(c) => {
                comment = Some(c.clone());
            }
            _ => {}
        }
    }

    CompiledRule {
        segments,
        extract_attr,
        js_extract,
        comment,
    }
}

/// Compile a full rule string (may contain || alternatives) into RuleAlternatives.
pub fn compile_rule(raw: &str) -> RuleAlternatives {
    let tokens = tokenizer::tokenize(raw);

    // Group tokens by alternative
    let mut alternatives: Vec<Vec<Token>> = vec![vec![]];

    for token in tokens {
        match &token {
            Token::Alternative => {
                alternatives.push(vec![]);
            }
            _ => {
                alternatives.last_mut().unwrap().push(token);
            }
        }
    }

    let compiled: Vec<CompiledRule> = alternatives
        .iter()
        .filter(|a| !a.is_empty())
        .map(|a| compile_one_alternative(a))
        .collect();

    RuleAlternatives {
        alternatives: if compiled.is_empty() {
            vec![CompiledRule {
                segments: vec![],
                extract_attr: None,
                js_extract: None,
                comment: None,
            }]
        } else {
            compiled
        },
    }
}

/// Compile a URL template, replacing {{key}} and {{page}} with {} for format!().
/// Returns the format string and whether it has page/key placeholders.
pub fn compile_url_template(raw: &str) -> (String, bool, bool) {
    let mut has_key = false;
    let mut has_page = false;

    let result = raw
        .replace("{{key}}", "{}")
        .replace("{{page}}", "{}");

    if raw.contains("{{key}}") {
        has_key = true;
    }
    if raw.contains("{{page}}") {
        has_page = true;
    }

    (result, has_key, has_page)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_segment_class() {
        let seg = parse_segment("class.title.0");
        assert_eq!(seg.selector_type, "class");
        assert_eq!(seg.value, "title");
        assert_eq!(seg.index, Some(0));
    }

    #[test]
    fn test_parse_segment_tag() {
        let seg = parse_segment("tag.a.1");
        assert_eq!(seg.selector_type, "tag");
        assert_eq!(seg.value, "a");
        assert_eq!(seg.index, Some(1));
    }

    #[test]
    fn test_parse_segment_no_index() {
        let seg = parse_segment("tag.h1");
        assert_eq!(seg.selector_type, "tag");
        assert_eq!(seg.value, "h1");
        assert_eq!(seg.index, None);
    }

    #[test]
    fn test_parse_extract_text() {
        let seg = parse_segment("text");
        assert_eq!(seg.selector_type, "_extract");
        assert_eq!(seg.value, "text");
    }

    #[test]
    fn test_parse_extract_html() {
        let seg = parse_segment("html");
        assert_eq!(seg.selector_type, "_extract");
        assert_eq!(seg.value, "html");
    }

    #[test]
    fn test_parse_css() {
        let seg = parse_segment("css.div.content>p");
        assert_eq!(seg.selector_type, "css");
        // The value should be the CSS selector (after "css.")
        assert!(seg.value.contains("div.content"));
        assert_eq!(seg.index, None);
    }

    #[test]
    fn test_parse_json() {
        let seg = parse_segment("json.$.data.books[*]");
        assert_eq!(seg.selector_type, "json");
        assert_eq!(seg.index, None);
    }

    #[test]
    fn test_parse_xpath() {
        let seg = parse_segment("xpath.//div[@class='content']");
        assert_eq!(seg.selector_type, "xpath");
        assert_eq!(seg.index, None);
    }

    #[test]
    fn test_parse_children() {
        let seg = parse_segment("children");
        assert_eq!(seg.selector_type, "children");
        assert_eq!(seg.value, "");
    }

    #[test]
    fn test_compile_simple_rule() {
        let rule = compile_rule("class.title@tag.a@text");
        assert_eq!(rule.alternatives.len(), 1);
        assert_eq!(rule.alternatives[0].segments.len(), 2);
        assert_eq!(rule.alternatives[0].segments[0].selector_type, "class");
        assert_eq!(rule.alternatives[0].segments[1].selector_type, "tag");
        assert_eq!(rule.alternatives[0].extract_attr, Some("text".into()));
    }

    #[test]
    fn test_compile_with_alternative() {
        let rule = compile_rule("class.title@text||tag.h1@text");
        assert_eq!(rule.alternatives.len(), 2);
    }

    #[test]
    fn test_compile_with_comment() {
        let rule = compile_rule("class.title@text##书名");
        assert_eq!(rule.alternatives.len(), 1);
        assert_eq!(
            rule.alternatives[0].comment,
            Some("书名".into())
        );
    }

    #[test]
    fn test_compile_js_extract() {
        let rule = compile_rule("class.content@js:result.replace('a','b')");
        assert_eq!(rule.alternatives.len(), 1);
        assert!(rule.alternatives[0].js_extract.is_some());
    }

    #[test]
    fn test_url_template_key() {
        let (result, has_key, has_page) =
            compile_url_template("https://example.com/search?keyword={{key}}");
        assert_eq!(result, "https://example.com/search?keyword={}");
        assert!(has_key);
        assert!(!has_page);
    }

    #[test]
    fn test_url_template_both() {
        let (result, has_key, has_page) =
            compile_url_template("https://example.com/search?keyword={{key}}&page={{page}}");
        assert_eq!(result, "https://example.com/search?keyword={}&page={}");
        assert!(has_key);
        assert!(has_page);
    }
}

/// Compile a full book source JSON into CompiledSource.
pub fn compile_source(json: &serde_json::Value) -> Result<CompiledSource, String> {
    use crate::source::types::*;

    let base_url = json["bookSourceUrl"]
        .as_str()
        .unwrap_or("")
        .to_string();

    let search = &json["ruleSearch"];
    let explore = &json["ruleExplore"];
    let book_info = &json["ruleBookInfo"];
    let toc = &json["ruleToc"];
    let content = &json["ruleContent"];

    Ok(CompiledSource {
        search_url: search["searchUrl"].as_str().unwrap_or("").to_string(),
        search_book_list: compile_rule(search["bookList"].as_str().unwrap_or("")),
        search_fields: SearchFields {
            name: opt_compile(&search["name"]),
            author: opt_compile(&search["author"]),
            cover_url: opt_compile(&search["coverUrl"]),
            intro: opt_compile(&search["intro"]),
            kind: opt_compile(&search["kind"]),
            word_count: opt_compile(&search["wordCount"]),
            last_chapter: opt_compile(&search["lastChapter"]),
            book_url: compile_rule(search["bookUrl"].as_str().unwrap_or("")).alternatives[0].clone(),
        },
        explore_url: explore["exploreUrl"].as_str().map(|s| s.to_string()),
        explore_book_list: maybe_compile_rule(&explore["bookList"]),
        explore_fields: maybe_compile_rule(&explore["bookList"]).map(|_| ExploreFields {
            name: opt_compile(&explore["name"]),
            author: opt_compile(&explore["author"]),
            cover_url: opt_compile(&explore["coverUrl"]),
            book_url: compile_rule(explore["bookUrl"].as_str().unwrap_or("")).alternatives[0].clone(),
        }),
        book_info_fields: BookInfoFields {
            name: compile_rule(book_info["name"].as_str().unwrap_or("")).alternatives[0].clone(),
            author: opt_compile(&book_info["author"]),
            cover_url: opt_compile(&book_info["coverUrl"]),
            intro: opt_compile(&book_info["intro"]),
            kind: opt_compile(&book_info["kind"]),
            word_count: opt_compile(&book_info["wordCount"]),
            last_chapter: opt_compile(&book_info["lastChapter"]),
            toc_url: compile_rule(book_info["tocUrl"].as_str().unwrap_or("")).alternatives[0].clone(),
        },
        toc_chapter_list: compile_rule(toc["chapterList"].as_str().unwrap_or("")),
        toc_chapter_name: compile_rule(toc["chapterName"].as_str().unwrap_or("")).alternatives[0].clone(),
        toc_chapter_url: compile_rule(toc["chapterUrl"].as_str().unwrap_or("")).alternatives[0].clone(),
        toc_next_url: opt_compile(&toc["nextTocUrl"]),
        content_rule: compile_rule(content["content"].as_str().unwrap_or("")).alternatives[0].clone(),
        content_next_url: opt_compile(&content["nextContentUrl"]),
        content_replace_regex: parse_replace_regex(&content["replaceRegex"]),
        header: Some(json["header"].clone()),
        base_url,
    })
}

fn opt_compile(val: &serde_json::Value) -> Option<CompiledRule> {
    val.as_str().filter(|s| !s.is_empty()).map(|s| {
        compile_rule(s).alternatives.into_iter().next().unwrap_or_default()
    })
}

fn maybe_compile_rule(val: &serde_json::Value) -> Option<RuleAlternatives> {
    val.as_str().filter(|s| !s.is_empty()).map(|s| compile_rule(s))
}

fn parse_replace_regex(val: &serde_json::Value) -> Vec<ReplaceRule> {
    let mut rules = Vec::new();
    if let Some(arr) = val.as_array() {
        for item in arr {
            rules.push(ReplaceRule {
                regex: item["regex"].as_str().unwrap_or("").to_string(),
                replacement: item["replacement"].as_str().unwrap_or("").to_string(),
            });
        }
    }
    rules
}
