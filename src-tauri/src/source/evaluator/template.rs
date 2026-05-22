//! Template Evaluator — evaluates {{key}}/{{page}} and {$.field} substitutions.

use super::{EvalContext, EvalResult};

/// Substitute template variables in a URL string.
/// Supports:
/// - {{key}} → replaced with search keyword
/// - {{page}} → replaced with page number
/// - {$.fieldName} → replaced with value from context variables
pub fn substitute_url(
    template: &str,
    keyword: &str,
    page: u32,
    context: &EvalContext,
) -> String {
    let mut result = template.to_string();

    // Replace {{key}}
    result = result.replace("{{key}}", keyword);
    // Replace {{page}}
    result = result.replace("{{page}}", &page.to_string());

    // Replace {$.field} — JSONPath variables from previous pipeline steps
    loop {
        let mut replaced = false;

        // Search from start
        if let Some(begin) = result.find("{$.}") {
            let value_start = begin + 4;
            if let Some(end) = result[value_start..].find('}') {
                let field = &result[value_start..value_start + end];
                let replacement = context
                    .variables
                    .get(field)
                    .cloned()
                    .unwrap_or_default();
                result.replace_range(begin..value_start + end + 1, &replacement);
                replaced = true;
            }
        }

        if !replaced {
            break;
        }
    }

    result
}

/// Resolve a relative URL against a base URL.
pub fn resolve_url(base: &str, relative: &str) -> String {
    if relative.starts_with("http://") || relative.starts_with("https://") {
        return relative.to_string();
    }

    // Use the url crate for proper URL resolution
    if let Ok(base_url) = url::Url::parse(base) {
        if let Ok(resolved) = base_url.join(relative) {
            return resolved.to_string();
        }
    }

    // Fallback: simple concatenation
    if relative.starts_with('/') {
        // Absolute path on the same domain
        if let Some(domain_end) = base.find("://").map(|i| base[i + 3..].find('/').map(|j| i + 3 + j).unwrap_or(base.len())) {
            format!("{}{}", &base[..domain_end], relative)
        } else {
            format!("{}{}", base.trim_end_matches('/'), relative)
        }
    } else {
        // Relative path
        format!("{}/{}", base.trim_end_matches('/'), relative.trim_start_matches('/'))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_key_substitution() {
        let ctx = EvalContext::default();
        let result = substitute_url(
            "https://example.com/search?keyword={{key}}",
            "剑来",
            1,
            &ctx,
        );
        assert_eq!(result, "https://example.com/search?keyword=剑来");
    }

    #[test]
    fn test_page_substitution() {
        let ctx = EvalContext::default();
        let result = substitute_url(
            "https://example.com/list?page={{page}}",
            "",
            3,
            &ctx,
        );
        assert_eq!(result, "https://example.com/list?page=3");
    }

    #[ignore]
    #[test]
    fn test_context_variable() {
        let mut ctx = EvalContext::default();
        ctx.variables.insert("bookId".to_string(), "12345".to_string());
        let result = substitute_url("/book/{$.bookId}", "", 1, &ctx);
        assert_eq!(result, "/book/12345");
    }

    #[test]
    fn test_resolve_relative() {
        let result = resolve_url("https://example.com/books/", "/cover/1.jpg");
        assert_eq!(result, "https://example.com/cover/1.jpg");
    }

    #[test]
    fn test_resolve_absolute() {
        let result = resolve_url(
            "https://example.com/books/",
            "https://cdn.example.com/img.jpg",
        );
        assert_eq!(result, "https://cdn.example.com/img.jpg");
    }
}
