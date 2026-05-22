//! Tokenizer for Legado rule strings.
//!
//! Splits a rule string on `@` (segment separator), `||` (alternative separator),
//! and `##` (comment separator).

/// A token produced by the tokenizer.
#[derive(Debug, Clone, PartialEq)]
pub enum Token {
    /// A raw segment token, e.g. "class.title.0"
    Segment(String),
    /// Alternative separator `||` — splits into alternative rules
    Alternative,
    /// Comment separator `##` — everything after is a comment
    Comment(String),
}

/// Tokenize a full rule string into a list of tokens.
///
/// Example:
/// ```text
/// "class.odd.0@tag.a.0@text||tag.dd.0@tag.h1@text##书名"
/// ```
/// becomes:
/// ```text
/// [Segment("class.odd.0"), Segment("tag.a.0"), Token::Attr("text"),
///  Alternative,
///  Segment("tag.dd.0"), Segment("tag.h1"), Token::Attr("text"),
///  Comment("书名")]
/// ```
pub fn tokenize(raw: &str) -> Vec<Token> {
    // Split by || first (highest precedence separator)
    let alt_parts: Vec<&str> = raw.split("||").collect();
    if alt_parts.is_empty() {
        return vec![];
    }

    let mut tokens = Vec::new();

    for (alt_idx, part) in alt_parts.into_iter().enumerate() {
        // Skip empty alternatives (trailing ||)
        if part.is_empty() {
            continue;
        }
        if alt_idx > 0 {
            tokens.push(Token::Alternative);
        }

        // Split by ## (comment separator)
        let hash_idx = part.find("##");
        let (rule_part, comment_text) = if let Some(idx) = hash_idx {
            (&part[..idx], Some(part[idx + 2..].trim().to_string()))
        } else {
            (part, None)
        };

        // Process @ segments — but for xpath/json, @ may appear inside the expression.
        // Strategy: parse segments manually, treating xpath/json as single segments.
        tokenize_segments(rule_part, &mut tokens);

        // Then the comment (after segments)
        if let Some(c) = comment_text {
            if !c.is_empty() {
                tokens.push(Token::Comment(c));
            }
        }
    }

    tokens
}

/// Split a rule part into @-separated segments, handling xpath/json specially.
fn tokenize_segments(rule_part: &str, tokens: &mut Vec<Token>) {
    let mut remaining = rule_part;
    while !remaining.is_empty() {
        // Skip leading @
        remaining = remaining.trim_start_matches('@');
        if remaining.is_empty() {
            break;
        }

        // Check if this starts with a special prefix that may contain @
        if let Some(rest) = remaining
            .strip_prefix("xpath.")
            .or_else(|| remaining.strip_prefix("json."))
        {
            // xpath/json: the selector is everything until the NEXT @ that starts a new segment
            // Pattern: after xpath./json., consume until we find @<non-special> where the next part
            // looks like a new rule segment (type.value or extract attr)
            if let Some(at_idx) = find_next_segment_at(rest) {
                let selector = format!("{}.{}", &remaining[..remaining.len() - rest.len()], &rest[..at_idx]);
                tokens.push(Token::Segment(selector));
                remaining = &rest[at_idx..];
            } else {
                // No more @ → the rest is the full selector
                tokens.push(Token::Segment(remaining.to_string()));
                break;
            }
        } else if remaining.starts_with("css.") {
            // CSS: similar to xpath — consume until next real @ segment
            let css_rest = &remaining[4..];
            if let Some(at_idx) = find_next_segment_at(css_rest) {
                let selector = format!("css.{}", &css_rest[..at_idx]);
                tokens.push(Token::Segment(selector));
                remaining = &css_rest[at_idx..];
            } else {
                tokens.push(Token::Segment(remaining.to_string()));
                break;
            }
        } else {
            // Regular segment: find next @
            if let Some(at_idx) = remaining.find('@') {
                tokens.push(Token::Segment(remaining[..at_idx].to_string()));
                remaining = &remaining[at_idx..];
            } else {
                tokens.push(Token::Segment(remaining.to_string()));
                break;
            }
        }
    }
}

/// Find the next @ that starts a real segment (not inside an xpath/json bracket).
fn find_next_segment_at(s: &str) -> Option<usize> {
    let mut depth = 0;
    let mut in_string = false;
    let mut string_char = '"';
    for (i, ch) in s.char_indices() {
        if in_string {
            if ch == string_char && s.as_bytes().get(i.saturating_sub(1)) != Some(&b'\\') {
                in_string = false;
            }
            continue;
        }
        match ch {
            '"' | '\'' => {
                in_string = true;
                string_char = ch;
            }
            '[' | '(' => depth += 1,
            ']' | ')' => depth -= 1,
            '@' if depth == 0 => return Some(i),
            _ => {}
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_rule() {
        let tokens = tokenize("class.title.0@tag.a@text");
        assert_eq!(tokens.len(), 3);
        assert_eq!(tokens[0], Token::Segment("class.title.0".into()));
        assert_eq!(tokens[1], Token::Segment("tag.a".into()));
        assert_eq!(tokens[2], Token::Segment("text".into()));
    }

    #[test]
    fn test_alternative() {
        let tokens = tokenize("class.title@text||tag.h1@text");
        assert_eq!(tokens.len(), 5);
        assert_eq!(tokens[0], Token::Segment("class.title".into()));
        assert_eq!(tokens[1], Token::Segment("text".into()));
        assert_eq!(tokens[2], Token::Alternative);
        assert_eq!(tokens[3], Token::Segment("tag.h1".into()));
        assert_eq!(tokens[4], Token::Segment("text".into()));
    }

    #[test]
    fn test_comment() {
        let tokens = tokenize("class.title@text##书名");
        assert_eq!(tokens.len(), 3);
        assert_eq!(tokens[0], Token::Segment("class.title".into()));
        assert_eq!(tokens[1], Token::Segment("text".into()));
        assert_eq!(tokens[2], Token::Comment("书名".into()));
    }

    #[test]
    fn test_full_rule() {
        let tokens = tokenize("class.odd.0@tag.a.0@text||tag.dd.0@tag.h1@text##书名");
        assert_eq!(tokens.len(), 8);
        assert_eq!(tokens[0], Token::Segment("class.odd.0".into()));
        assert_eq!(tokens[1], Token::Segment("tag.a.0".into()));
        assert_eq!(tokens[2], Token::Segment("text".into()));
        assert_eq!(tokens[3], Token::Alternative);
        assert_eq!(tokens[4], Token::Segment("tag.dd.0".into()));
        assert_eq!(tokens[5], Token::Segment("tag.h1".into()));
        assert_eq!(tokens[6], Token::Segment("text".into()));
        assert_eq!(tokens[7], Token::Comment("书名".into()));
    }

    #[test]
    fn test_css_rule() {
        let tokens = tokenize("css.div.content>p@text");
        assert_eq!(tokens.len(), 2);
        assert_eq!(tokens[0], Token::Segment("css.div.content>p".into()));
        assert_eq!(tokens[1], Token::Segment("text".into()));
    }

    #[test]
    fn test_xpath_rule() {
        let tokens = tokenize("xpath.//div[@class='content']@text");
        assert_eq!(tokens.len(), 2);
    }

    #[test]
    fn test_json_rule() {
        let tokens = tokenize("json.$.data.books[*]@text");
        assert_eq!(tokens.len(), 2);
    }

    #[test]
    fn test_js_rule() {
        let tokens = tokenize("js.document.querySelector('.content').innerHTML");
        // js: often has no @ segments
        assert_eq!(tokens.len(), 1);
        assert!(matches!(tokens[0], Token::Segment(_)));
    }

    #[test]
    fn test_regex_rule() {
        let tokens = tokenize("regex.第(\\d+)章.0@text");
        assert_eq!(tokens.len(), 2);
    }

    #[test]
    fn test_empty_alternative() {
        // Some rules have trailing ||
        let tokens = tokenize("class.title@text||");
        assert_eq!(tokens.len(), 2);
    }
}
