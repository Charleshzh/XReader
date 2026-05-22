//! WebDAV sync backend implementation using reqwest.

use super::types::{SyncBackend, SyncEntry};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use std::time::Duration;

pub struct WebDavBackend {
    url: String,
    username: String,
    password: String,
    client: reqwest::Client,
}

impl WebDavBackend {
    pub fn new(url: String, username: String, password: String) -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to build HTTP client for WebDAV");

        Self {
            url: url.trim_end_matches('/').to_string(),
            username,
            password,
            client,
        }
    }

    fn auth_header(&self) -> String {
        let creds = format!("{}:{}", self.username, self.password);
        let encoded = base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            creds.as_bytes(),
        );
        format!("Basic {}", encoded)
    }

    fn full_url(&self, path: &str) -> String {
        format!("{}/{}", self.url, path.trim_start_matches('/'))
    }
}

#[async_trait::async_trait]
impl SyncBackend for WebDavBackend {
    async fn upload(&self, path: &str, data: &[u8]) -> Result<(), String> {
        let url = self.full_url(path);
        let resp = self
            .client
            .put(&url)
            .header(AUTHORIZATION, &self.auth_header())
            .body(data.to_vec())
            .send()
            .await
            .map_err(|e| format!("WebDAV upload error: {}", e))?;

        if resp.status().is_success() {
            Ok(())
        } else {
            Err(format!("WebDAV upload failed: HTTP {}", resp.status()))
        }
    }

    async fn download(&self, path: &str) -> Result<Vec<u8>, String> {
        let url = self.full_url(path);
        let resp = self
            .client
            .get(&url)
            .header(AUTHORIZATION, &self.auth_header())
            .send()
            .await
            .map_err(|e| format!("WebDAV download error: {}", e))?;

        if resp.status().is_success() {
            resp.bytes()
                .await
                .map(|b| b.to_vec())
                .map_err(|e| format!("WebDAV read error: {}", e))
        } else if resp.status().as_u16() == 404 {
            Err("File not found".to_string())
        } else {
            Err(format!("WebDAV download failed: HTTP {}", resp.status()))
        }
    }

    async fn list(&self, prefix: &str) -> Result<Vec<SyncEntry>, String> {
        // WebDAV PROPFIND request
        let url = self.full_url(prefix);
        let body = r#"<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:getlastmodified/>
    <D:getcontentlength/>
  </D:prop>
</D:propfind>"#;

        let resp = self
            .client
            .request(reqwest::Method::from_bytes(b"PROPFIND").unwrap(), &url)
            .header(AUTHORIZATION, &self.auth_header())
            .header("Depth", "1")
            .header("Content-Type", "application/xml")
            .body(body)
            .send()
            .await
            .map_err(|e| format!("WebDAV PROPFIND error: {}", e))?;

        let status = resp.status();
        if !status.is_success() && status.as_u16() != 207 {
            return Err(format!("WebDAV list failed: HTTP {}", status));
        }

        let xml = resp
            .text()
            .await
            .map_err(|e| format!("WebDAV read error: {}", e))?;

        parse_propfind_response(&xml, &self.url)
    }

    async fn delete(&self, path: &str) -> Result<(), String> {
        let url = self.full_url(path);
        let resp = self
            .client
            .delete(&url)
            .header(AUTHORIZATION, &self.auth_header())
            .send()
            .await
            .map_err(|e| format!("WebDAV delete error: {}", e))?;

        if resp.status().is_success() || resp.status().as_u16() == 404 {
            Ok(())
        } else {
            Err(format!("WebDAV delete failed: HTTP {}", resp.status()))
        }
    }

    async fn check_connection(&self) -> Result<(), String> {
        // Try a PROPFIND on the root
        let url = &self.url;
        let resp = self
            .client
            .request(reqwest::Method::from_bytes(b"PROPFIND").unwrap(), url)
            .header(AUTHORIZATION, &self.auth_header())
            .header("Depth", "0")
            .send()
            .await
            .map_err(|e| format!("Connection failed: {}", e))?;

        if resp.status().is_success() || resp.status().as_u16() == 207 {
            Ok(())
        } else {
            Err(format!("Connection failed: HTTP {} — check URL and credentials", resp.status()))
        }
    }
}

/// Simple XML parser for PROPFIND response — extracts href, getlastmodified, getcontentlength.
fn parse_propfind_response(xml: &str, base_url: &str) -> Result<Vec<SyncEntry>, String> {
    let mut entries = Vec::new();
    let mut current_href = String::new();
    let mut current_modified = String::new();
    let mut current_size = String::new();
    let mut _in_href = false;
    let mut _in_modified = false;
    let mut _in_size = false;
    // ... (keep the assignments inside the loop as-is)
    // Simple state-machine XML parser (avoids full XML crate dependency)
    for line in xml.lines() {
        let trimmed = line.trim();

        if trimmed.contains("<D:href>") {
            _in_href = true;
            current_href = extract_text(trimmed, "D:href");
        } else if trimmed.contains("<D:getlastmodified>") {
            _in_modified = true;
            current_modified = extract_text(trimmed, "D:getlastmodified");
        } else if trimmed.contains("<D:getcontentlength>") {
            _in_size = true;
            current_size = extract_text(trimmed, "D:getcontentlength");
        } else if trimmed.contains("</D:response>") || trimmed.contains("</d:response>") {
            if !current_href.is_empty() {
                let path = current_href
                    .trim_start_matches(base_url)
                    .trim_start_matches('/')
                    .to_string();

                if !path.is_empty() && !path.ends_with('/') {
                    let timestamp = parse_http_date(&current_modified);
                    let size: u64 = current_size.parse().unwrap_or(0);
                    entries.push(SyncEntry {
                        path,
                        last_modified: timestamp,
                        size,
                    });
                }
            }
            current_href.clear();
            current_modified.clear();
            current_size.clear();
        }
    }

    // If no </D:response> tags found, try simpler parsing
    if entries.is_empty() && !current_href.is_empty() {
        let path = current_href
            .trim_start_matches(base_url)
            .trim_start_matches('/')
            .to_string();
        if !path.is_empty() && !path.ends_with('/') {
            let timestamp = parse_http_date(&current_modified);
            let size: u64 = current_size.parse().unwrap_or(0);
            entries.push(SyncEntry { path, last_modified: timestamp, size });
        }
    }

    Ok(entries)
}

fn extract_text(line: &str, tag: &str) -> String {
    let start_tag = format!("<{}>", tag);
    let end_tag = format!("</{}>", tag);

    if let Some(start) = line.find(&start_tag) {
        let after_start = &line[start + start_tag.len()..];
        if let Some(end) = after_start.find(&end_tag) {
            return after_start[..end].to_string();
        }
    }
    String::new()
}

fn parse_http_date(date: &str) -> i64 {
    // Try to parse HTTP date formats: "Mon, 22 May 2026 12:00:00 GMT"
    if let Ok(dt) = chrono::DateTime::parse_from_rfc2822(date) {
        return dt.timestamp();
    }
    // Try ISO 8601
    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(date) {
        return dt.timestamp();
    }
    0
}
