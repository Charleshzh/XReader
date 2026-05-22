//! JSON Evaluator — evaluates json.* rules using jsonpath-rust.

use crate::source::types::*;
use jsonpath_rust::JsonPath;
use scraper::Html;
use serde_json::Value as JsonValue;
use super::{EvalContext, EvalResult};

/// Evaluate a json rule against HTML (extracts text content, parses as JSON).
pub fn evaluate(
    html: &Html,
    rule: &CompiledRule,
    _context: &EvalContext,
) -> EvalResult {
    let text: String = html.root_element().text().collect();
    evaluate_json_str(&text, rule, _context)
}

/// Evaluate a json rule against a JSON string.
pub fn evaluate_json_str(
    json_str: &str,
    rule: &CompiledRule,
    _context: &EvalContext,
) -> EvalResult {
    if rule.segments.is_empty() {
        return EvalResult::Empty;
    }

    let first = &rule.segments[0];
    if first.selector_type != "json" {
        return EvalResult::Empty;
    }

    let json_val: JsonValue = match serde_json::from_str(json_str) {
        Ok(v) => v,
        Err(_) => return EvalResult::Empty,
    };

    // Execute JSONPath query using the JsonPath trait method
    let path_expr = first.value.as_str();
    let results = match json_val.query(path_expr) {
        Ok(v) => v,
        Err(_) => return EvalResult::Empty,
    };

    let attr = rule.extract_attr.as_deref().unwrap_or("text");

    if results.is_empty() {
        return EvalResult::Empty;
    }

    if results.len() == 1 {
        let val = json_value_to_string(results[0], attr);
        if val.is_empty() {
            EvalResult::Empty
        } else {
            EvalResult::Value(val)
        }
    } else {
        let values: Vec<String> = results.iter().map(|v| json_value_to_string(v, attr)).collect();
        if values.is_empty() {
            EvalResult::Empty
        } else {
            EvalResult::Values(values)
        }
    }
}

fn json_value_to_string(val: &JsonValue, attr: &str) -> String {
    match attr {
        "text" | "textNodes" | "ownText" => match val {
            JsonValue::String(s) => s.clone(),
            JsonValue::Number(n) => n.to_string(),
            JsonValue::Bool(b) => b.to_string(),
            JsonValue::Null => String::new(),
            _ => val.to_string(),
        },
        "html" => match val {
            JsonValue::String(s) => s.clone(),
            _ => val.to_string(),
        },
        _ => {
            if let JsonValue::Object(obj) = val {
                obj.get(attr)
                    .map(|v| json_value_to_string(v, "text"))
                    .unwrap_or_default()
            } else if let JsonValue::String(s) = val {
                s.clone()
            } else {
                val.to_string()
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::source::compiler::compile_rule;

    #[test]
    fn test_json_simple() {
        let json = r#"{"title": "Test Book", "author": "Author"}"#;
        let rule = compile_rule("json.$.title@text");
        let ctx = EvalContext::default();
        let result = evaluate_json_str(json, &rule.alternatives[0], &ctx);
        assert_eq!(result.into_value().unwrap(), "Test Book");
    }

    #[test]
    fn test_json_array() {
        let json = r#"{"data": {"books": [{"title": "A"}, {"title": "B"}]}}"#;
        let rule = compile_rule("json.$.data.books[*].title@text");
        let ctx = EvalContext::default();
        let result = evaluate_json_str(json, &rule.alternatives[0], &ctx);
        let vals = result.into_values();
        assert!(vals.len() >= 1);
    }

    #[test]
    fn test_json_field_as_attr() {
        let json = r#"{"name": "Book", "cover": "cover.jpg"}"#;
        let rule = compile_rule("json.$@cover");
        let ctx = EvalContext::default();
        let result = evaluate_json_str(json, &rule.alternatives[0], &ctx);
        assert_eq!(result.into_value().unwrap(), "cover.jpg");
    }
}
