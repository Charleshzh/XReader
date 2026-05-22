//! CSS Evaluator: evaluates class/id/tag/text/children/css rules using the scraper crate.

use crate::source::compiler::compile_rule;
use crate::source::types::*;
use scraper::{ElementRef, Html, Selector};
use super::{EvalContext, EvalResult};

/// Evaluate a CompiledRule against HTML using CSS selectors.
pub fn evaluate(
    html: &Html,
    rule: &CompiledRule,
    _context: &EvalContext,
) -> EvalResult {
    if rule.segments.is_empty() {
        return EvalResult::Empty;
    }

    let mut elements = select_initial(html, &rule.segments[0]);

    // Apply remaining segments as sub-selectors
    for seg in &rule.segments[1..] {
        elements = select_sub(&elements, seg);
        if elements.is_empty() {
            return EvalResult::Empty;
        }
    }

    if elements.is_empty() {
        return EvalResult::Empty;
    }

    // Extract attribute from the first matching element
    let attr = rule.extract_attr.as_deref().unwrap_or("text");
    extract_attr_from_elements(&elements, attr)
}

/// Select initial elements from the HTML document based on the first segment.
fn select_initial<'a>(html: &'a Html, seg: &RuleSegment) -> Vec<ElementRef<'a>> {
    match seg.selector_type.as_str() {
        "class" => select_by_selector(html, &format!(".{}", seg.value), seg.index),
        "id" => select_by_selector(html, &format!("#{}", seg.value), seg.index),
        "tag" => select_by_selector(html, &seg.value, seg.index),
        "text" => {
            // text matching: find elements containing the given text
            let escaped = seg.value.replace('"', "\\\"");
            select_by_selector(html, &format!("*:contains(\"{}\")", escaped), seg.index)
        }
        "css" => select_by_selector(html, &seg.value, seg.index),
        "children" => {
            // children: select all direct children of <body>
            let sel = Selector::parse("body > *").unwrap();
            let mut elements: Vec<ElementRef> = html.select(&sel).collect();
            if let Some(idx) = seg.index {
                elements = elements.into_iter().skip(idx).take(1).collect();
            }
            elements
        }
        _ => vec![],
    }
}

/// Apply a sub-selector to existing elements.
fn select_sub<'a>(parents: &[ElementRef<'a>], seg: &RuleSegment) -> Vec<ElementRef<'a>> {
    let mut result = Vec::new();
    for parent in parents {
        let children = select_on_element(*parent, seg);
        result.extend(children);
    }
    result
}

fn select_on_element<'a>(el: ElementRef<'a>, seg: &RuleSegment) -> Vec<ElementRef<'a>> {
    match seg.selector_type.as_str() {
        "class" => {
            select_on_element_by(el, &format!(".{}", seg.value), seg.index)
        }
        "id" => select_on_element_by(el, &format!("#{}", seg.value), seg.index),
        "tag" => select_on_element_by(el, &seg.value, seg.index),
        "text" => {
            let escaped = seg.value.replace('"', "\\\"");
            select_on_element_by(el, &format!("*:contains(\"{}\")", escaped), seg.index)
        }
        "css" => select_on_element_by(el, &seg.value, seg.index),
        "children" => {
            // Select all direct children
            let mut children: Vec<ElementRef> = el.children().filter_map(|c| {
                ElementRef::wrap(c)
            }).collect();
            if let Some(idx) = seg.index {
                children = children.into_iter().skip(idx).take(1).collect();
            }
            children
        }
        _ => vec![],
    }
}

fn select_by_selector<'a>(
    html: &'a Html,
    css_selector: &str,
    index: Option<usize>,
) -> Vec<ElementRef<'a>> {
    let sel = match Selector::parse(css_selector) {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    let mut elements: Vec<ElementRef> = html.select(&sel).collect();
    if let Some(idx) = index {
        elements = elements.into_iter().skip(idx).take(1).collect();
    }
    elements
}

fn select_on_element_by<'a>(
    el: ElementRef<'a>,
    css_selector: &str,
    index: Option<usize>,
) -> Vec<ElementRef<'a>> {
    let sel = match Selector::parse(css_selector) {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    let mut elements: Vec<ElementRef> = el.select(&sel).collect();
    if let Some(idx) = index {
        elements = elements.into_iter().skip(idx).take(1).collect();
    }
    elements
}

/// Extract attribute from matching elements.
fn extract_attr_from_elements(elements: &[ElementRef], attr: &str) -> EvalResult {
    match attr {
        "text" => {
            let text: String = elements
                .iter()
                .map(|e| e.text().collect::<String>())
                .collect();
            if text.trim().is_empty() {
                EvalResult::Empty
            } else {
                EvalResult::Value(text.trim().to_string())
            }
        }
        "textNodes" => {
            // Pure text nodes only
            let text: String = elements
                .iter()
                .flat_map(|e| e.text())
                .collect();
            if text.trim().is_empty() {
                EvalResult::Empty
            } else {
                EvalResult::Value(text.trim().to_string())
            }
        }
        "ownText" => {
            let text: String = elements
                .iter()
                .map(|e| {
                    e.children()
                        .filter_map(|c| c.value().as_text())
                        .map(|t| t.to_string())
                        .collect::<String>()
                })
                .collect::<Vec<_>>()
                .join("");
            if text.trim().is_empty() {
                EvalResult::Empty
            } else {
                EvalResult::Value(text.trim().to_string())
            }
        }
        "href" => extract_single_attr(elements, "href"),
        "src" => extract_single_attr(elements, "src"),
        "html" => {
            let html: String = elements.iter().map(|e| e.inner_html()).collect();
            if html.trim().is_empty() {
                EvalResult::Empty
            } else {
                EvalResult::Value(html)
            }
        }
        "all" => {
            let html: String = elements
                .iter()
                .map(|e| e.inner_html())
                .collect::<Vec<_>>()
                .join("");
            if html.trim().is_empty() {
                EvalResult::Empty
            } else {
                EvalResult::Value(html)
            }
        }
        _ => {
            // Try as a custom attribute name
            extract_single_attr(elements, attr)
        }
    }
}

fn extract_single_attr(elements: &[ElementRef], attr: &str) -> EvalResult {
    for el in elements {
        if let Some(val) = el.value().attr(attr) {
            let s = val.trim().to_string();
            if !s.is_empty() {
                return EvalResult::Value(s);
            }
        }
    }
    EvalResult::Empty
}

#[cfg(test)]
mod tests {
    use super::*;
    use scraper::Html;

    #[test]
    fn test_class_rule() {
        let html = Html::parse_fragment(r#"<div class="title">Hello World</div>"#);
        let rule = compile_rule("class.title@text");
        let ctx = EvalContext::default();
        let result = evaluate(&html, &rule.alternatives[0], &ctx);
        assert_eq!(result.into_value().unwrap(), "Hello World");
    }

    #[test]
    fn test_tag_rule() {
        let html = Html::parse_fragment(r#"<h1>Title</h1>"#);
        let rule = compile_rule("tag.h1@text");
        let ctx = EvalContext::default();
        let result = evaluate(&html, &rule.alternatives[0], &ctx);
        assert_eq!(result.into_value().unwrap(), "Title");
    }

    #[test]
    fn test_chained_rule() {
        let html = Html::parse_fragment(
            r#"<div class="item"><a href="/book/1">Book Name</a></div>"#,
        );
        let rule = compile_rule("class.item@tag.a@text");
        let ctx = EvalContext::default();
        let result = evaluate(&html, &rule.alternatives[0], &ctx);
        assert_eq!(result.into_value().unwrap(), "Book Name");
    }

    #[test]
    fn test_href_extract() {
        let html = Html::parse_fragment(r#"<a class="link" href="/book/1">Link</a>"#);
        let rule = compile_rule("class.link@tag.a@href");
        let ctx = EvalContext::default();
        let result = evaluate(&html, &rule.alternatives[0], &ctx);
        assert_eq!(result.into_value().unwrap(), "/book/1");
    }

    #[test]
    fn test_alternative_rule() {
        let html = Html::parse_fragment(r#"<h1>Title</h1>"#);
        // First alternative fails, second succeeds
        let rule = compile_rule("class.nonexist@text||tag.h1@text");
        let ctx = EvalContext::default();
        let result = evaluate(&html, &rule.alternatives[0], &ctx);
        assert_eq!(result.into_value().unwrap(), "Title");
    }

    #[test]
    fn test_text_contains() {
        let html = Html::parse_fragment(r#"<span>下一章</span><span>上一章</span>"#);
        // text matching is done via :contains() in scraper
        let sel = Selector::parse("*:contains(\"下一章\")").unwrap();
        let elements: Vec<ElementRef> = html.select(&sel).collect();
        assert_eq!(elements.len(), 1);
    }

    #[test]
    fn test_html_extract() {
        let html = Html::parse_fragment(
            r#"<div class="content"><p>Hello</p><p>World</p></div>"#,
        );
        let rule = compile_rule("class.content@html");
        let ctx = EvalContext::default();
        let result = evaluate(&html, &rule.alternatives[0], &ctx);
        let val = result.into_value().unwrap();
        assert!(val.contains("<p>Hello</p>"));
    }
}
