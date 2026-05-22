//! HTTP client wrapper for book source scraping.

use reqwest::header::{HeaderMap, HeaderName, HeaderValue, USER_AGENT};
use std::collections::HashMap;
use std::time::Duration;

/// HTTP client for fetching novel website pages with encoding detection.
pub struct SourceHttpClient {
    client: reqwest::Client,
    default_headers: HeaderMap,
}

impl SourceHttpClient {
    pub fn new() -> Self {
        let mut headers = HeaderMap::new();
        headers.insert(
            USER_AGENT,
            HeaderValue::from_static(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            ),
        );

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .cookie_store(true)
            .default_headers(headers.clone())
            .build()
            .expect("Failed to build HTTP client");

        Self {
            client,
            default_headers: headers,
        }
    }

    /// Fetch a URL and return the response body as a string, with encoding detection.
    pub async fn fetch(
        &self,
        url: &str,
        extra_headers: Option<&HashMap<String, String>>,
    ) -> Result<String, String> {
        let mut req = self.client.get(url);

        // Apply extra headers from book source config
        if let Some(hdrs) = extra_headers {
            for (k, v) in hdrs {
                if let (Ok(name), Ok(value)) = (
                    HeaderName::from_bytes(k.as_bytes()),
                    HeaderValue::from_str(v),
                ) {
                    req = req.header(name, value);
                }
            }
        }

        let resp = req.send().await.map_err(|e| format!("HTTP error: {}", e))?;

        let status = resp.status();
        if !status.is_success() {
            return Err(format!("HTTP {} for {}", status, url));
        }

        let bytes = resp
            .bytes()
            .await
            .map_err(|e| format!("Read error: {}", e))?;

        // Detect encoding
        decode_bytes(&bytes)
    }
}

/// Decode bytes to string with encoding detection.
fn decode_bytes(bytes: &[u8]) -> Result<String, String> {
    // Try UTF-8 first
    if let Ok(s) = std::str::from_utf8(bytes) {
        return Ok(s.to_string());
    }

    // Try to detect encoding from HTML meta tag
    let head = String::from_utf8_lossy(&bytes[..bytes.len().min(1024)]);
    if let Some(enc) = detect_encoding_from_meta(&head) {
        return decode_with_encoding(bytes, &enc);
    }

    // Fallback: try common Chinese encodings
    if let Ok(s) = decode_with_encoding(bytes, "gbk") {
        if !s.is_empty() {
            return Ok(s);
        }
    }
    if let Ok(s) = decode_with_encoding(bytes, "big5") {
        if !s.is_empty() {
            return Ok(s);
        }
    }

    // Last resort: lossy UTF-8
    Ok(String::from_utf8_lossy(bytes).to_string())
}

fn detect_encoding_from_meta(html_head: &str) -> Option<String> {
    // Look for <meta charset="..."> or <meta http-equiv="Content-Type" content="...;charset=...">
    let lower = html_head.to_lowercase();

    // <meta charset="gbk">
    if let Some(pos) = lower.find("charset=") {
        let rest = &lower[pos + 8..];
        let enc: String = rest
            .chars()
            .take_while(|c| c.is_alphanumeric() || *c == '-')
            .collect();
        if !enc.is_empty() {
            return Some(enc);
        }
    }

    None
}

fn decode_with_encoding(bytes: &[u8], encoding: &str) -> Result<String, String> {
    let enc = match encoding.to_lowercase().as_str() {
        "gbk" | "gb2312" | "gb18030" => encoding_rs::GBK,
        "big5" => encoding_rs::BIG5,
        "shift_jis" | "shift-jis" | "sjis" => encoding_rs::SHIFT_JIS,
        "euc-jp" | "euc_jp" => encoding_rs::EUC_JP,
        "euc-kr" => encoding_rs::EUC_KR,
        "utf-8" | "utf8" => encoding_rs::UTF_8,
        "iso-8859-1" | "latin1" => encoding_rs::WINDOWS_1252,
        _ => return Err(format!("Unsupported encoding: {}", encoding)),
    };

    let (decoded, _, had_errors) = enc.decode(bytes);
    if had_errors {
        // Fallback: try to re-decode with lossy UTF-8
        return Ok(String::from_utf8_lossy(bytes).to_string());
    }
    Ok(decoded.into_owned())
}
