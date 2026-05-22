//! SourcePipeline — orchestrates HTTP fetching + rule evaluation for 4 operations.

use crate::source::evaluator::{self, EvalContext};
use crate::source::http::SourceHttpClient;
use crate::source::types::*;
use scraper::Html;
use std::collections::HashMap;

pub mod book_info;
pub mod chapter_content;
pub mod chapter_list;
pub mod search;

pub struct SourcePipeline {
    pub source: CompiledSource,
    http: SourceHttpClient,
    context: EvalContext,
}

impl SourcePipeline {
    pub fn new(source: CompiledSource) -> Self {
        let ctx = EvalContext {
            base_url: Some(source.base_url.clone()),
            ..Default::default()
        };

        Self {
            source,
            http: SourceHttpClient::new(),
            context: ctx,
        }
    }

    pub async fn fetch_html(&self, url: &str) -> Result<Html, String> {
        let html_str = self
            .http
            .fetch(url, self.source.header.as_ref().map(|h| {
                let mut map = HashMap::new();
                if let Some(obj) = h.as_object() {
                    for (k, v) in obj {
                        if let Some(val) = v.as_str() {
                            map.insert(k.clone(), val.to_string());
                        }
                    }
                }
                map
            }).as_ref())
            .await?;
        Ok(Html::parse_document(&html_str))
    }

    pub fn search_url(&self, keyword: &str, page: u32) -> String {
        evaluator::template::substitute_url(
            &self.source.search_url,
            keyword,
            page,
            &self.context,
        )
    }

    pub fn set_var(&mut self, key: &str, value: &str) {
        self.context
            .variables
            .insert(key.to_string(), value.to_string());
    }
}
