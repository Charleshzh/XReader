//! Sync types and SyncBackend trait for cross-device cloud sync.

use serde::{Deserialize, Serialize};

/// Trait for swappable sync backends (WebDAV, S3, custom REST, etc.).
#[async_trait::async_trait]
pub trait SyncBackend: Send + Sync {
    /// Upload data to a remote path.
    async fn upload(&self, path: &str, data: &[u8]) -> Result<(), String>;

    /// Download data from a remote path.
    async fn download(&self, path: &str) -> Result<Vec<u8>, String>;

    /// List files under a prefix, returning (path, last_modified_timestamp).
    async fn list(&self, prefix: &str) -> Result<Vec<SyncEntry>, String>;

    /// Delete a remote file.
    async fn delete(&self, path: &str) -> Result<(), String>;

    /// Check if the backend is reachable.
    async fn check_connection(&self) -> Result<(), String>;
}

/// A file entry returned by list().
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncEntry {
    pub path: String,
    pub last_modified: i64,
    pub size: u64,
}

/// Configuration for the sync backend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConfig {
    pub enabled: bool,
    pub backend_type: String, // "webdav"
    pub url: String,
    pub username: String,
    pub password: String,
    pub auto_sync_interval_minutes: u32,
}

impl Default for SyncConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            backend_type: "webdav".into(),
            url: String::new(),
            username: String::new(),
            password: String::new(),
            auto_sync_interval_minutes: 30,
        }
    }
}
