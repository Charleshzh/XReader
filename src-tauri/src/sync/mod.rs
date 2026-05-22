//! Sync engine for cross-device cloud sync.

pub mod types;
pub mod webdav;

use rusqlite::Connection;
use serde::Serialize;
use std::time::{SystemTime, UNIX_EPOCH};
use types::{SyncBackend, SyncConfig};

const SYNC_TABLES: &[&str] = &["books", "reading_progress", "bookmarks", "annotations", "book_sources"];

#[derive(Debug, Clone, Serialize)]
pub struct SyncResult {
    pub uploaded: usize,
    pub downloaded: usize,
    pub conflicts: usize,
    pub errors: Vec<String>,
    pub timestamp: i64,
}

pub struct SyncEngine {
    config: SyncConfig,
    backend: Option<Box<dyn SyncBackend>>,
}

impl SyncEngine {
    pub fn new(config: SyncConfig) -> Self {
        let backend: Option<Box<dyn SyncBackend>> = if config.enabled && !config.url.is_empty() {
            Some(Box::new(webdav::WebDavBackend::new(
                config.url.clone(),
                config.username.clone(),
                config.password.clone(),
            )))
        } else {
            None
        };
        Self { config, backend }
    }

    pub fn reconfigure(&mut self, config: SyncConfig) {
        self.backend = if config.enabled && !config.url.is_empty() {
            Some(Box::new(webdav::WebDavBackend::new(
                config.url.clone(),
                config.username.clone(),
                config.password.clone(),
            )))
        } else {
            None
        };
        self.config = config;
    }

    pub async fn sync(&self, db: &Connection) -> Result<SyncResult, String> {
        let backend = self.backend.as_ref().ok_or("Sync not configured")?;
        backend.check_connection().await?;

        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() as i64;
        let mut result = SyncResult { uploaded: 0, downloaded: 0, conflicts: 0, errors: Vec::new(), timestamp: now };

        for table in SYNC_TABLES {
            match sync_table(backend.as_ref(), db, table).await {
                Ok((up, down)) => { result.uploaded += up; result.downloaded += down; }
                Err(e) => result.errors.push(format!("{}: {}", table, e)),
            }
        }

        Ok(result)
    }
}

async fn sync_table(backend: &dyn SyncBackend, db: &Connection, table: &str) -> Result<(usize, usize), String> {
    let local_last: Option<i64> = db
        .query_row("SELECT last_synced_at FROM sync_meta WHERE table_name = ?1", rusqlite::params![table], |row| row.get(0))
        .ok();

    let remote_files = backend.list(&format!("xreader/{}", table)).await?;
    let mut uploaded = 0usize;
    let mut downloaded = 0usize;

    let local_data = export_table_since(db, table, local_last.unwrap_or(0))?;
    if !local_data.is_empty() {
        backend.upload(&format!("xreader/{}/latest.json", table), local_data.as_bytes()).await?;
        uploaded += 1;
    }

    for entry in &remote_files {
        if entry.last_modified > local_last.unwrap_or(0) {
            if let Ok(_data) = backend.download(&entry.path).await {
                downloaded += 1;
            }
        }
    }

    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() as i64;
    db.execute("INSERT OR REPLACE INTO sync_meta (table_name, last_synced_at) VALUES (?1, ?2)", rusqlite::params![table, now])
        .map_err(|e| e.to_string())?;

    Ok((uploaded, downloaded))
}

fn export_table_since(db: &Connection, table: &str, since: i64) -> Result<String, String> {
    let query = match table {
        "books" => "SELECT json_object('id', id, 'title', title, 'author', author, 'format', format, 'updated_at', updated_at) FROM books WHERE updated_at >= ?1",
        "reading_progress" => "SELECT json_object('book_id', book_id, 'chapter_index', chapter_index, 'position', position, 'updated_at', updated_at) FROM reading_progress WHERE updated_at >= ?1",
        "bookmarks" => "SELECT json_object('id', id, 'book_id', book_id, 'chapter_index', chapter_index, 'position', position, 'label', label, 'created_at', created_at) FROM bookmarks WHERE created_at >= ?1",
        "annotations" => "SELECT json_object('id', id, 'book_id', book_id, 'text', text, 'note', note, 'updated_at', updated_at) FROM annotations WHERE updated_at >= ?1",
        "book_sources" => "SELECT json_object('id', id, 'name', name, 'base_url', base_url, 'updated_at', updated_at) FROM book_sources WHERE updated_at >= ?1",
        _ => return Ok("[]".to_string()),
    };

    let mut stmt = db.prepare(query).map_err(|e| e.to_string())?;
    let rows: Vec<String> = stmt
        .query_map(rusqlite::params![since], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(format!("[{}]", rows.join(",")))
}
