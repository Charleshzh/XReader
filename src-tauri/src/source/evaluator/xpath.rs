//! XPath Evaluator — evaluates xpath.* rules using sxd-xpath.

use crate::source::types::*;
use scraper::Html;
use sxd_document::parser;
use sxd_xpath::{Context as XPathContext, Factory, Value};
use super::{EvalContext, EvalResult};

pub fn evaluate(
    html: &Html,
    rule: &CompiledRule,
    _context: &EvalContext,
) -> EvalResult {
    if rule.segments.is_empty() {
        return EvalResult::Empty;
    }
    let first = &rule.segments[0];
    if first.selector_type != "xpath" {
        return EvalResult::Empty;
    }

    let html_str = html.html();
    let package = parser::parse(&html_str);
    if package.is_err() {
        let wrapped = format!("<root>{}</root>", html_str);
        let package = parser::parse(&wrapped);
        if package.is_err() {
            return EvalResult::Empty;
        }
        evaluate_with_package(&package.unwrap(), &first.value, rule)
    } else {
        evaluate_with_package(&package.unwrap(), &first.value, rule)
    }
}

fn evaluate_with_package(
    package: &sxd_document::Package,
    xpath_expr: &str,
    rule: &CompiledRule,
) -> EvalResult {
    let document = package.as_document();
    let factory = Factory::new();
    let xpath = match factory.build(xpath_expr) {
        Ok(Some(x)) => x,
        _ => return EvalResult::Empty,
    };

    let context = XPathContext::new();
    let root = document.root();
    match xpath.evaluate(&context, root) {
        Ok(value) => xpath_value_to_result(&value, rule.extract_attr.as_deref().unwrap_or("text")),
        Err(_) => EvalResult::Empty,
    }
}

fn xpath_value_to_result(value: &Value, attr: &str) -> EvalResult {
    match value {
        Value::Nodeset(nodes) => {
            // Use documented_order to iterate
            let ordered = nodes.document_order();
            if ordered.len() == 0 {
                return EvalResult::Empty;
            }

            match attr {
                "text" | "textNodes" | "ownText" => {
                    let text: String = ordered.iter()
                        .map(|n| n.string_value())
                        .collect();
                    let trimmed = text.trim().to_string();
                    if trimmed.is_empty() {
                        EvalResult::Empty
                    } else {
                        EvalResult::Value(trimmed)
                    }
                }
                "html" | "all" => {
                    let html = ordered.iter().next()
                        .map(|n| n.string_value())
                        .unwrap_or_default();
                    if html.trim().is_empty() {
                        EvalResult::Empty
                    } else {
                        EvalResult::Value(html)
                    }
                }
                _ => {
                    if let Some(node) = ordered.first() {
                        if let Some(el) = node.element() {
                            if let Some(av) = el.attribute(attr) {
                                let val = av.value().trim().to_string();
                                if !val.is_empty() {
                                    return EvalResult::Value(val);
                                }
                            }
                        }
                    }
                    EvalResult::Empty
                }
            }
        }
        Value::Boolean(b) => EvalResult::Value(if *b { "true" } else { "false" }.to_string()),
        Value::Number(n) => EvalResult::Value(n.to_string()),
        Value::String(s) => EvalResult::Value(s.clone()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::source::compiler::compile_rule;
    use scraper::Html;

    #[test]
    fn test_xpath_simple() {
        let html = Html::parse_fragment(r#"<div class="content">Hello</div>"#);
        let rule = compile_rule("xpath.//div[@class='content']@text");
        let ctx = EvalContext::default();
        let result = evaluate(&html, &rule.alternatives[0], &ctx);
        assert_eq!(result.into_value().unwrap(), "Hello");
    }

    #[test]
    fn test_xpath_h1() {
        let html = Html::parse_fragment(r#"<h1>My Title</h1>"#);
        let rule = compile_rule("xpath.//h1@text");
        let ctx = EvalContext::default();
        let result = evaluate(&html, &rule.alternatives[0], &ctx);
        assert_eq!(result.into_value().unwrap(), "My Title");
    }
}
