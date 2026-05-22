//! Explore pipeline: discover books from a source homepage/ranking/recommendations.

use super::SourcePipeline;
use crate::source::evaluator;
use scraper::Html;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct ExploreResult {
    pub name: String,
    pub author: String,
    pub cover_url: String,
    pub book_url: String,
}

impl SourcePipeline {
    pub async fn explore(&mut self, page: u32) -> Result<Vec<ExploreResult>, String> {
        let explore_url = self
            .source
            .explore_url
            .as_ref()
            .ok_or_else(|| "This source does not support explore".to_string())?;

        let explore_book_list = self
            .source
            .explore_book_list
            .as_ref()
            .ok_or_else(|| "No explore book list rule defined".to_string())?;

        let explore_fields = self
            .source
            .explore_fields
            .as_ref()
            .ok_or_else(|| "No explore fields defined".to_string())?;

        // Substitute {{page}}
        let url = evaluator::template::substitute_url(explore_url, "", page, &self.context);

        let html = self.fetch_html(&url).await?;

        // Evaluate book list rule on the page
        let book_items = evaluator::evaluate_rule(&html, explore_book_list, &self.context);
        let values = book_items.into_values();
        let mut results = Vec::new();

        if values.is_empty() {
            return Ok(results);
        }

        for item_html in values {
            let item = Html::parse_fragment(&item_html);
            let book_url = eval_field(&item, &explore_fields.book_url);
            let resolved_url = evaluator::template::resolve_url(&self.source.base_url, &book_url);

            results.push(ExploreResult {
                name: eval_opt(&item, &explore_fields.name),
                author: eval_opt(&item, &explore_fields.author),
                cover_url: eval_opt(&item, &explore_fields.cover_url),
                book_url: resolved_url,
            });
        }

        Ok(results)
    }
}

fn eval_opt(html: &Html, rule: &Option<crate::source::types::CompiledRule>) -> String {
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

fn eval_field(html: &Html, rule: &crate::source::types::CompiledRule) -> String {
    let alternatives = crate::source::types::RuleAlternatives {
        alternatives: vec![rule.clone()],
    };
    evaluator::evaluate_rule(html, &alternatives, &Default::default())
        .into_value()
        .unwrap_or_default()
}
