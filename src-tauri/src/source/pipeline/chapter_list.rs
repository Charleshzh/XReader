//! ChapterList pipeline: fetch TOC page → extract chapter list.

use super::SourcePipeline;
use crate::source::evaluator::{self, EvalResult};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct ChapterItem {
    pub name: String,
    pub url: String,
    pub index: usize,
}

impl SourcePipeline {
    /// Fetch the chapter list from the TOC page.
    pub async fn get_chapter_list(&mut self, toc_url: &str) -> Result<Vec<ChapterItem>, String> {
        let html = self.fetch_html(toc_url).await?;

        // Evaluate chapterList to get individual chapter items
        let chapter_items =
            evaluator::evaluate_rule(&html, &self.source.toc_chapter_list, &self.context);
        let values = chapter_items.into_values();

        if values.is_empty() {
            return Err("No chapters found in TOC".to_string());
        }

        let mut chapters = Vec::new();

        for (i, item_html) in values.iter().enumerate() {
            let item = scraper::Html::parse_fragment(item_html);

            let name = eval_field(&item, &self.source.toc_chapter_name);
            let url = evaluator::template::resolve_url(
                &self.source.base_url,
                &eval_field(&item, &self.source.toc_chapter_url),
            );

            if name.is_empty() && url.is_empty() {
                continue;
            }

            chapters.push(ChapterItem {
                name,
                url,
                index: i,
            });
        }

        Ok(chapters)
    }

    /// Check if there's a next TOC page.
    pub async fn get_next_toc_url(&mut self, toc_url: &str) -> Option<String> {
        if self.source.toc_next_url.is_none() {
            return None;
        }

        let html = self.fetch_html(toc_url).await.ok()?;
        let next = eval_field(&html, self.source.toc_next_url.as_ref().unwrap());
        if next.is_empty() {
            None
        } else {
            Some(evaluator::template::resolve_url(&self.source.base_url, &next))
        }
    }
}

fn eval_field(html: &scraper::Html, rule: &crate::source::types::CompiledRule) -> String {
    let alternatives = crate::source::types::RuleAlternatives {
        alternatives: vec![rule.clone()],
    };
    evaluator::evaluate_rule(html, &alternatives, &Default::default())
        .into_value()
        .unwrap_or_default()
}
