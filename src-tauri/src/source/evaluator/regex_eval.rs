//! Regex Evaluator — evaluates regex.* rules and replaceRegex cleaning.

use super::{EvalContext, EvalResult};
use crate::source::types::*;
use regex::Regex;
use scraper::Html;

/// Evaluate a regex rule against HTML (operates on text content).
pub fn evaluate(html: &Html, rule: &CompiledRule, _context: &EvalContext) -> EvalResult {
    if rule.segments.is_empty() {
        return EvalResult::Empty;
    }

    let first = &rule.segments[0];
    if first.selector_type != "regex" {
        return EvalResult::Empty;
    }

    // Get full text content
    let text: String = html.root_element().text().collect();

    let re = match Regex::new(&first.value) {
        Ok(r) => r,
        Err(_) => return EvalResult::Empty,
    };

    let _attr = rule.extract_attr.as_deref().unwrap_or("text");

    if let Some(caps) = re.captures(&text) {
        // If there's a specific capture group index, use it
        let result = if let Some(idx) = first.index {
            caps.get(idx).map(|m| m.as_str().to_string())
        } else {
            caps.get(0).map(|m| m.as_str().to_string())
        };

        match result {
            Some(s) => EvalResult::Value(s),
            None => EvalResult::Empty,
        }
    } else {
        EvalResult::Empty
    }
}

/// Apply replaceRegex rules to clean chapter content.
pub fn apply_replace_regex(
    content: &str,
    replace_rules: &[crate::source::types::ReplaceRule],
) -> String {
    let mut result = content.to_string();
    for rule in replace_rules {
        if let Ok(re) = Regex::new(&rule.regex) {
            result = re
                .replace_all(&result, rule.replacement.as_str())
                .to_string();
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::source::compiler::compile_rule;
    use scraper::Html;

    #[test]
    fn test_regex_extract() {
        let html = Html::parse_fragment("Chapter 123: The Beginning");
        let rule = compile_rule("regex.Chapter (\\d+).0@text");
        let ctx = EvalContext::default();
        let result = evaluate(&html, &rule.alternatives[0], &ctx);
        // The regex matches "Chapter 123" and capture group 0 is the full match
        assert!(result.into_value().unwrap().contains("Chapter 123"));
    }

    #[test]
    fn test_regex_capture_group() {
        let html = Html::parse_fragment("Chapter 123: The Beginning");
        let rule = compile_rule("regex.Chapter (\\d+).1@text");
        let ctx = EvalContext::default();
        let result = evaluate(&html, &rule.alternatives[0], &ctx);
        assert_eq!(result.into_value().unwrap(), "123");
    }

    #[test]
    fn test_replace_regex() {
        let content = "请收藏本站：www.example.com 正文内容";
        let rules = vec![crate::source::types::ReplaceRule {
            regex: "请收藏本站.*".to_string(),
            replacement: String::new(),
        }];
        let cleaned = apply_replace_regex(content, &rules);
        assert!(!cleaned.contains("请收藏本站"));
    }

    #[test]
    fn test_replace_nbsp() {
        let content = "Hello&nbsp;World";
        let rules = vec![crate::source::types::ReplaceRule {
            regex: "&nbsp;".to_string(),
            replacement: " ".to_string(),
        }];
        let cleaned = apply_replace_regex(content, &rules);
        assert_eq!(cleaned, "Hello World");
    }
}
