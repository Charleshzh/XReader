//! BookInfo pipeline: fetch book detail page → extract metadata.

use super::SourcePipeline;
use crate::source::evaluator::{self, EvalResult};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct BookInfo {
    pub name: String,
    pub author: String,
    pub cover_url: String,
    pub intro: String,
    pub kind: String,
    pub word_count: String,
    pub last_chapter: String,
    pub toc_url: String,
}

impl SourcePipeline {
    pub async fn get_book_info(&mut self, book_url: &str) -> Result<BookInfo, String> {
        let html = self.fetch_html(book_url).await?;

        // Clone fields to avoid borrow conflicts
        let name_rule = self.source.book_info_fields.name.clone();
        let author_rule = self.source.book_info_fields.author.clone();
        let cover_url_rule = self.source.book_info_fields.cover_url.clone();
        let intro_rule = self.source.book_info_fields.intro.clone();
        let kind_rule = self.source.book_info_fields.kind.clone();
        let word_count_rule = self.source.book_info_fields.word_count.clone();
        let last_chapter_rule = self.source.book_info_fields.last_chapter.clone();
        let toc_url_rule = self.source.book_info_fields.toc_url.clone();

        let toc_url_raw = eval_field(&html, &toc_url_rule);
        let toc_url = evaluator::template::resolve_url(&self.source.base_url, &toc_url_raw);

        self.set_var("tocUrl", &toc_url);

        Ok(BookInfo {
            name: eval_field(&html, &name_rule),
            author: eval_opt(&html, &author_rule),
            cover_url: evaluator::template::resolve_url(
                &self.source.base_url,
                &eval_opt(&html, &cover_url_rule),
            ),
            intro: eval_opt(&html, &intro_rule),
            kind: eval_opt(&html, &kind_rule),
            word_count: eval_opt(&html, &word_count_rule),
            last_chapter: eval_opt(&html, &last_chapter_rule),
            toc_url,
        })
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

fn eval_opt(html: &scraper::Html, rule: &Option<crate::source::types::CompiledRule>) -> String {
    match rule {
        Some(r) => eval_field(html, r),
        None => String::new(),
    }
}
