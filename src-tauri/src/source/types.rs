use serde::{Deserialize, Serialize};

/// A single segment in a Legado rule chain: type.value.index
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RuleSegment {
    /// Selector type: class, id, tag, text, children, css, xpath, json, regex, js
    pub selector_type: String,
    /// The value part (class name, CSS selector, XPath expression, etc.)
    pub value: String,
    /// The index (0-based, optional)
    pub index: Option<usize>,
}

/// A compiled rule = a chain of segments with an optional extraction attribute.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CompiledRule {
    /// Segments in order, joined by @
    pub segments: Vec<RuleSegment>,
    /// Extraction attribute: text, textNodes, ownText, href, src, html, all
    pub extract_attr: Option<String>,
    /// If extraction is done via JavaScript: @js:expression
    pub js_extract: Option<String>,
    /// Comment text after ##
    pub comment: Option<String>,
}

/// Alternative rules separated by || — try each until one returns a non-empty result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleAlternatives {
    pub alternatives: Vec<CompiledRule>,
}

/// A fully compiled book source, ready for evaluation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompiledSource {
    // Search
    pub search_url: String,
    pub search_book_list: RuleAlternatives,
    pub search_fields: SearchFields,

    // Explore
    pub explore_url: Option<String>,
    pub explore_book_list: Option<RuleAlternatives>,
    pub explore_fields: Option<ExploreFields>,

    // Book info
    pub book_info_fields: BookInfoFields,

    // TOC
    pub toc_chapter_list: RuleAlternatives,
    pub toc_chapter_name: CompiledRule,
    pub toc_chapter_url: CompiledRule,
    pub toc_next_url: Option<CompiledRule>,

    // Content
    pub content_rule: CompiledRule,
    pub content_next_url: Option<CompiledRule>,
    pub content_replace_regex: Vec<ReplaceRule>,

    // Misc
    pub header: Option<serde_json::Value>,
    pub base_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchFields {
    pub name: Option<CompiledRule>,
    pub author: Option<CompiledRule>,
    pub cover_url: Option<CompiledRule>,
    pub intro: Option<CompiledRule>,
    pub kind: Option<CompiledRule>,
    pub word_count: Option<CompiledRule>,
    pub last_chapter: Option<CompiledRule>,
    pub book_url: CompiledRule,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExploreFields {
    pub name: Option<CompiledRule>,
    pub author: Option<CompiledRule>,
    pub cover_url: Option<CompiledRule>,
    pub book_url: CompiledRule,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookInfoFields {
    pub name: CompiledRule,
    pub author: Option<CompiledRule>,
    pub cover_url: Option<CompiledRule>,
    pub intro: Option<CompiledRule>,
    pub kind: Option<CompiledRule>,
    pub word_count: Option<CompiledRule>,
    pub last_chapter: Option<CompiledRule>,
    pub toc_url: CompiledRule,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplaceRule {
    pub regex: String,
    pub replacement: String,
}
