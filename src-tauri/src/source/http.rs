//! HTTP client wrapper for book source scraping.

use reqwest::{
    header::{HeaderMap, HeaderName, HeaderValue, USER_AGENT},
    redirect,
};
use std::collections::HashMap;
use std::time::Duration;

const ALLOWED_SCHEMES: &[&str] = &["http", "https"];

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
            .redirect(redirect::Policy::none())
            .default_headers(headers.clone())
            .build()
            .expect("Failed to build HTTP client");

        Self {
            client,
            default_headers: headers,
        }
    }

    /// Validate a URL for safe fetching: must be http/https, no internal IPs.
    fn validate_url(url: &str) -> Result<(), String> {
        let parsed = url::Url::parse(url).map_err(|e| format!("Invalid URL: {}", e))?;

        let scheme = parsed.scheme();
        if !ALLOWED_SCHEMES.contains(&scheme) {
            return Err(format!("URL scheme '{}' not allowed", scheme));
        }

        // Reject loopback and private IPs
        if let Some(host) = parsed.host_str() {
            let host_lower = host.to_lowercase();
            if host_lower == "localhost"
                || host_lower == "127.0.0.1"
                || host_lower == "::1"
                || host_lower.starts_with("0.")
                || host_lower.starts_with("10.")
                || host_lower.starts_with("172.16.")
                || host_lower.starts_with("192.168.")
                || host_lower.starts_with("169.254.")
            {
                return Err(format!("Access to internal host '{}' blocked", host));
            }
        }

        Ok(())
    }

    /// Fetch a URL and return the response body as a string, with encoding detection.
    /// Handles redirects manually to re-validate each hop.
    pub async fn fetch(
        &self,
        url: &str,
        extra_headers: Option<&HashMap<String, String>>,
    ) -> Result<String, String> {
        let mut current_url = url.to_string();
        // Follow up to 10 redirects, re-validating each URL
        for _redirect_attempt in 0..10 {
            Self::validate_url(&current_url)?;

            let mut req = self.client.get(&current_url);

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

            // Handle redirects manually
            if status.is_redirection() {
                if let Some(location) = resp.headers().get("location") {
                    if let Ok(loc) = location.to_str() {
                        // Resolve relative redirect against current URL
                        let base = url::Url::parse(&current_url)
                            .map_err(|e| format!("Invalid base URL: {}", e))?;
                        current_url = base
                            .join(loc)
                            .map_err(|e| format!("Invalid redirect URL: {}", e))?
                            .to_string();
                        continue;
                    }
                }
                return Err(format!("HTTP {} redirect without valid location", status));
            }

            if !status.is_success() {
                return Err(format!("HTTP {} for {}", status, current_url));
            }

            let bytes = resp
                .bytes()
                .await
                .map_err(|e| format!("Read error: {}", e))?;

            return decode_bytes(&bytes);
        }

        Err("Too many redirects".to_string())
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
    let lower = html_head.to_lowercase();

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
        return Ok(String::from_utf8_lossy(bytes).to_string());
    }
    Ok(decoded.into_owned())
}
