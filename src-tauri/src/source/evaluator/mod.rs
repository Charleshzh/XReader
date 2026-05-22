//! RuleEvaluator: dispatches rule evaluation to the appropriate evaluator.
//!
//! Each evaluator takes an HTML/JSON input and a CompiledRule, and returns the extracted string.

use crate::source::types::*;
use scraper::Html;

pub mod css;
pub mod js;
pub mod json;
pub mod regex_eval;
pub mod template;
pub mod xpath;

/// Context available during evaluation (for JS and template variables).
#[derive(Debug, Clone, Default)]
pub struct EvalContext {
    /// Variables set by previous pipeline steps, accessed via {$.field}
    pub variables: std::collections::HashMap<String, String>,
    /// Base URL for resolving relative URLs
    pub base_url: Option<String>,
}

/// Result of evaluating a rule.
#[derive(Debug, Clone)]
pub enum EvalResult {
    /// A single string value
    Value(String),
    /// Multiple values (for bookList extraction)
    Values(Vec<String>),
    /// No match found
    Empty,
}

impl EvalResult {
    pub fn is_empty(&self) -> bool {
        matches!(self, EvalResult::Empty)
    }

    pub fn into_value(self) -> Option<String> {
        match self {
            EvalResult::Value(s) => Some(s),
            EvalResult::Values(mut v) => {
                if v.is_empty() {
                    None
                } else {
                    Some(v.remove(0))
                }
            }
            EvalResult::Empty => None,
        }
    }

    pub fn into_values(self) -> Vec<String> {
        match self {
            EvalResult::Value(s) => vec![s],
            EvalResult::Values(v) => v,
            EvalResult::Empty => vec![],
        }
    }
}

/// Evaluate a CompiledRule against an HTML document, trying each alternative.
pub fn evaluate_rule(
    html: &Html,
    rule: &RuleAlternatives,
    context: &EvalContext,
) -> EvalResult {
    for alt in &rule.alternatives {
        let result = evaluate_single(html, alt, context);
        if !result.is_empty() {
            return result;
        }
    }
    EvalResult::Empty
}

/// Evaluate a single CompiledRule (no || alternatives).
fn evaluate_single(
    html: &Html,
    rule: &CompiledRule,
    context: &EvalContext,
) -> EvalResult {
    use crate::source::types::*;

    if rule.segments.is_empty() {
        return EvalResult::Empty;
    }

    let first_type = &rule.segments[0].selector_type;

    match first_type.as_str() {
        "class" | "id" | "tag" | "text" | "children" | "css" => {
            css::evaluate(html, rule, context)
        }
        "xpath" => xpath::evaluate(html, rule, context),
        "json" => json::evaluate(html, rule, context),
        "regex" => regex_eval::evaluate(html, rule, context),
        "js" => js::evaluate(html, rule, context),
        _ => EvalResult::Empty,
    }
}

/// Evaluate a rule against a JSON string (for JSON APIs).
pub fn evaluate_rule_json(
    json_str: &str,
    rule: &RuleAlternatives,
    context: &EvalContext,
) -> EvalResult {
    for alt in &rule.alternatives {
        if let Some(first) = alt.segments.first() {
            if first.selector_type == "json" {
                let result = json::evaluate_json_str(json_str, alt, context);
                if !result.is_empty() {
                    return result;
                }
            }
        }
    }
    EvalResult::Empty
}
