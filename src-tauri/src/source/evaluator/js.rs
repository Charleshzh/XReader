//! JS Evaluator — evaluates js: prefix and @js: suffix rules using rquickjs.

use super::{EvalContext, EvalResult};
use crate::source::types::*;
use rquickjs::{Context as JsContext, Runtime};
use scraper::Html;

pub fn evaluate(html: &Html, rule: &CompiledRule, _context: &EvalContext) -> EvalResult {
    if rule.segments.is_empty() {
        return EvalResult::Empty;
    }
    let first = &rule.segments[0];
    if first.selector_type != "js" {
        return EvalResult::Empty;
    }

    let text: String = html.root_element().text().collect();
    let result = run_js_expression(&first.value, &text);

    match result {
        Ok(val) => {
            if let Some(ref js_extract) = rule.js_extract {
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
    let runtime = Runtime::new().map_err(|e| format!("JS: {}", e))?;
    let ctx = JsContext::full(&runtime).map_err(|e| format!("JS: {}", e))?;

    ctx.with(|ctx| {
        // Build a self-executing function that has access to the text content
        let escaped = text
            .replace('\\', "\\\\")
            .replace('\'', "\\'")
            .replace('\n', "\\n");
        let expr = format!(
            "(function() {{ return {}; }})()",
            js_code.replace("document.text", &format!("'{}'", escaped))
        );
        let result: String = ctx.eval(expr).map_err(|e| format!("JS eval: {}", e))?;
        Ok(result)
    })
}

fn run_js_transform(input: &str, js_code: &str) -> Result<String, String> {
    let runtime = Runtime::new().map_err(|e| format!("JS: {}", e))?;
    let ctx = JsContext::full(&runtime).map_err(|e| format!("JS: {}", e))?;

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
    use scraper::Html;

    #[ignore]
    #[test]
    fn test_js_simple_eval() {
        let html = Html::parse_fragment("<p>hello</p>");
        let rule = compile_rule("js.'hello'.toUpperCase()");
        let ctx = EvalContext::default();
        let result = evaluate(&html, &rule.alternatives[0], &ctx);
        assert_eq!(result.into_value().unwrap(), "HELLO");
    }
}
