//! ChapterContent pipeline: fetch chapter page → extract content + clean.

use super::SourcePipeline;
use crate::source::evaluator::{self, EvalResult};

impl SourcePipeline {
    /// Fetch and clean chapter content.
    pub async fn get_chapter_content(&mut self, chapter_url: &str) -> Result<String, String> {
        let html = self.fetch_html(chapter_url).await?;

        // Evaluate content rule
        let content = evaluator::evaluate_rule(
            &html,
            &crate::source::types::RuleAlternatives {
                alternatives: vec![self.source.content_rule.clone()],
            },
            &self.context,
        );

        let raw = content.into_value().unwrap_or_default();

        if raw.is_empty() {
            return Err("Empty chapter content".to_string());
        }

        // Apply replaceRegex cleaning
        let cleaned =
            evaluator::regex_eval::apply_replace_regex(&raw, &self.source.content_replace_regex);

        Ok(cleaned)
    }

    pub async fn get_next_chapter_url(&mut self, chapter_url: &str) -> Option<String> {
        let _ = self.source.content_next_url.as_ref()?;

        let html = self.fetch_html(chapter_url).await.ok()?;
        let next = evaluator::evaluate_rule(
            &html,
            &crate::source::types::RuleAlternatives {
                alternatives: vec![self.source.content_next_url.as_ref().unwrap().clone()],
            },
            &self.context,
        )
        .into_value()
        .unwrap_or_default();

        if next.is_empty() {
            None
        } else {
            Some(evaluator::template::resolve_url(
                &self.source.base_url,
                &next,
            ))
        }
    }
}
