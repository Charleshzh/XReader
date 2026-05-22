//! Search pipeline: search books → extract list.

use super::SourcePipeline;
use crate::source::evaluator::{self, EvalResult};
use scraper::Html;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct SearchResult {
    pub name: String,
    pub author: String,
    pub cover_url: String,
    pub intro: String,
    pub kind: String,
    pub word_count: String,
    pub last_chapter: String,
    pub book_url: String,
}

impl SourcePipeline {
    pub async fn search(&mut self, keyword: &str, page: u32) -> Result<Vec<SearchResult>, String> {
        let url = self.search_url(keyword, page);
        let html = self.fetch_html(&url).await?;

        let book_items = evaluator::evaluate_rule(&html, &self.source.search_book_list, &self.context);
        let values = book_items.into_values();
        let mut results = Vec::new();

        if values.is_empty() {
            return Ok(results);
        }

        for item_html in values {
            let item = Html::parse_fragment(&item_html);
            let book_url = _eval_field(&item, &self.source.search_fields.book_url);
            let resolved_url = evaluator::template::resolve_url(&self.source.base_url, &book_url);

            results.push(SearchResult {
                name: eval_opt_html(&item, &self.source.search_fields.name),
                author: eval_opt_html(&item, &self.source.search_fields.author),
                cover_url: eval_opt_html(&item, &self.source.search_fields.cover_url),
                intro: eval_opt_html(&item, &self.source.search_fields.intro),
                kind: eval_opt_html(&item, &self.source.search_fields.kind),
                word_count: eval_opt_html(&item, &self.source.search_fields.word_count),
                last_chapter: eval_opt_html(&item, &self.source.search_fields.last_chapter),
                book_url: resolved_url,
            });
        }

        Ok(results)
    }
}

fn eval_opt_html(html: &Html, rule: &Option<crate::source::types::CompiledRule>) -> String {
    match rule {
        Some(r) => {
            let alternatives = crate::source::types::RuleAlternatives {
                alternatives: vec![r.clone()],
            };
            evaluator::evaluate_rule(html, &alternatives, &Default::default())
                .into_value()
                .unwrap_or_default()
        }
        None => String::new(),
    }
}

fn _eval_field(html: &Html, rule: &crate::source::types::CompiledRule) -> String {
    let alternatives = crate::source::types::RuleAlternatives {
        alternatives: vec![rule.clone()],
    };
    evaluator::evaluate_rule(html, &alternatives, &Default::default())
        .into_value()
        .unwrap_or_default()
}
