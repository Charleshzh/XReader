//! JS Evaluator — evaluates js: prefix and @js: suffix rules using rquickjs.
//! Security: runs in restricted context with execution timeout.

use super::{EvalContext, EvalResult};
use crate::source::types::*;
use rquickjs::{Context as JsContext, Function, Runtime};
use scraper::Html;
use std::time::Duration;

const JS_EXEC_TIMEOUT_MS: u64 = 3000;

/// Maximum length for JS code and text input to prevent DoS.
const MAX_JS_CODE_LEN: usize = 4096;
const MAX_TEXT_LEN: usize = 65536;

pub fn evaluate(html: &Html, rule: &CompiledRule, _context: &EvalContext) -> EvalResult {
    if rule.segments.is_empty() {
        return EvalResult::Empty;
    }
    let first = &rule.segments[0];
    if first.selector_type != "js" {
        return EvalResult::Empty;
    }

    if first.value.len() > MAX_JS_CODE_LEN {
        return EvalResult::Empty;
    }

    let text: String = html.root_element().text().collect();
    let text = if text.len() > MAX_TEXT_LEN {
        text[..MAX_TEXT_LEN].to_string()
    } else {
        text
    };

    let result = run_js_expression(&first.value, &text);

    match result {
        Ok(val) => {
            if let Some(ref js_extract) = rule.js_extract {
                if js_extract.len() > MAX_JS_CODE_LEN {
                    return EvalResult::Empty;
                }
                match run_js_transform(&val, js_extract) {
                    Ok(transformed) => {
                        if transformed.is_empty() {
                            EvalResult::Empty
                        } else {
                            EvalResult::Value(transformed)
                        }
                    }
                    Err(_) => EvalResult::Value(val),
                }
            } else {
                if val.is_empty() {
                    EvalResult::Empty
                } else {
                    EvalResult::Value(val)
                }
            }
        }
        Err(_) => EvalResult::Empty,
    }
}

fn run_js_expression(js_code: &str, text: &str) -> Result<String, String> {
    let runtime = Runtime::new().map_err(|e| format!("JS runtime: {}", e))?;

    // Set an interrupt handler for execution timeout
    let start = std::time::Instant::now();
    runtime.set_interrupt_handler(Some(Box::new(move || {
        start.elapsed() > Duration::from_millis(JS_EXEC_TIMEOUT_MS)
    })));

    // Use restricted context — no filesystem, no network
    let ctx = JsContext::full(&runtime).map_err(|e| format!("JS context: {}", e))?;

    ctx.with(|ctx| {
        // Remove potentially dangerous globals
        let globals = ctx.globals();
        if globals.contains_key("eval").unwrap_or(false) {
            globals
                .set("eval", Function::new(ctx.clone(), || {}).unwrap())
                .unwrap_or(());
        }

        let escaped = text
            .replace('\\', "\\\\")
            .replace('\'', "\\'")
            .replace('\n', "\\n")
            .replace('\r', "");

        let expr = format!(
            "(function() {{ return {}; }})()",
            js_code.replace("document.text", &format!("'{}'", escaped))
        );

        let result: String = ctx.eval(expr).map_err(|e| format!("JS eval: {}", e))?;
        Ok(result)
    })
}

fn run_js_transform(input: &str, js_code: &str) -> Result<String, String> {
    let runtime = Runtime::new().map_err(|e| format!("JS runtime: {}", e))?;

    let start = std::time::Instant::now();
    runtime.set_interrupt_handler(Some(Box::new(move || {
        start.elapsed() > Duration::from_millis(JS_EXEC_TIMEOUT_MS)
    })));

    let ctx = JsContext::full(&runtime).map_err(|e| format!("JS context: {}", e))?;

    ctx.with(|ctx| {
        let escaped = input.replace('\\', "\\\\").replace('\'', "\\'");
        let expr = format!(
            "(function() {{ var result = '{}'; return {}; }})()",
            escaped, js_code
        );

        let result: String = ctx.eval(expr).map_err(|e| format!("JS eval: {}", e))?;
        Ok(result)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::source::compiler::compile_rule;

    /// Verify that infinite loops are terminated by the timeout.
    #[test]
    fn test_js_timeout_on_infinite_loop() {
        let html = Html::parse_fragment("<p>hello</p>");
        let rule = compile_rule("js.while(true){}");
        let ctx = EvalContext::default();
        let result = evaluate(&html, &rule.alternatives[0], &ctx);
        // Should return Empty (timeout) not hang
        assert!(matches!(result, EvalResult::Empty));
    }

    /// Verify that excessively long JS code is rejected.
    #[test]
    fn test_js_rejects_long_code() {
        let html = Html::parse_fragment("<p>hello</p>");
        let long_code = "a".repeat(5000);
        // Build a rule manually with long JS code
        let rule = crate::source::types::CompiledRule {
            segments: vec![crate::source::types::RuleSegment {
                selector_type: "js".to_string(),
                value: long_code,
                index: Some(0),
            }],
            js_extract: None,
            extract_attr: None,
            comment: None,
        };
        let ctx = EvalContext::default();
        let result = evaluate(&html, &rule, &ctx);
        assert!(matches!(result, EvalResult::Empty));
    }
}
