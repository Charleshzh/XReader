//! Sync engine for cross-device cloud sync.

pub mod types;
pub mod webdav;

use rusqlite::Connection;
use serde::Serialize;
use serde_json::Value;
use std::time::{SystemTime, UNIX_EPOCH};
use types::{SyncBackend, SyncConfig};

const SYNC_TABLES: &[&str] = &[
    "books",
    "reading_progress",
    "bookmarks",
    "annotations",
    "book_sources",
];

#[derive(Debug, Clone, Serialize)]
pub struct SyncResult {
    pub uploaded: usize,
    pub downloaded: usize,
    pub conflicts: usize,
    pub errors: Vec<String>,
    pub timestamp: i64,
}

/// Pre-read data needed for sync, so we can drop the DB lock before network I/O.
pub(crate) struct SyncSnapshot {
    local_data: Vec<(String, String)>, // (table, json_rows)
    last_synced: Vec<(String, i64)>,   // (table, last_synced_at)
    tables: Vec<String>,
}

impl SyncSnapshot {
    fn read(db: &Connection) -> Result<Self, String> {
        let mut last_synced = Vec::new();
        let mut local_data = Vec::new();

        for table in SYNC_TABLES {
            let last: i64 = db
                .query_row(
                    "SELECT last_synced_at FROM sync_meta WHERE table_name = ?1",
                    rusqlite::params![*table],
                    |row| row.get(0),
                )
                .unwrap_or(0);

            last_synced.push(((*table).to_string(), last));
            let json = export_table_since(db, table, last)?;
            local_data.push(((*table).to_string(), json));
        }

        Ok(Self {
            local_data,
            last_synced,
            tables: SYNC_TABLES.iter().map(|s| (*s).to_string()).collect(),
        })
    }

    fn last_synced_for(&self, table: &str) -> i64 {
        self.last_synced
            .iter()
            .find(|(t, _)| t == table)
            .map(|&(_, ts)| ts)
            .unwrap_or(0)
    }

    fn local_data_for(&self, table: &str) -> Option<&str> {
        self.local_data
            .iter()
            .find(|(t, _)| t == table)
            .map(|(_, d)| d.as_str())
    }
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

    /// Phase 1: read snapshot (caller holds DB lock)
    pub fn prepare_snapshot(&self, db: &Connection) -> Result<SyncSnapshot, String> {
        SyncSnapshot::read(db)
    }

    /// Phase 2: network upload + download (no DB lock held)
    pub async fn sync_network(
        &self,
        snapshot: &SyncSnapshot,
    ) -> Result<Vec<(String, Vec<Value>)>, String> {
        let backend = self.backend.as_ref().ok_or("Sync not configured")?;
        backend.check_connection().await?;

        // Upload local changes
        for table in &snapshot.tables {
            let data = snapshot.local_data_for(table).unwrap_or("[]");
            if data != "[]" {
                backend
                    .upload(&format!("xreader/{}/latest.json", table), data.as_bytes())
                    .await?;
            }
        }

        // Download remote data
        let mut remote_rows: Vec<(String, Vec<Value>)> = Vec::new();
        for table in &snapshot.tables {
            let path = format!("xreader/{}/latest.json", table);
            match backend.download(&path).await {
                Ok(data) => {
                    let text = String::from_utf8_lossy(&data);
                    if let Ok(rows) = serde_json::from_str::<Vec<Value>>(&text) {
                        remote_rows.push((table.clone(), rows));
                    }
                }
                Err(_) => {
                    // Remote file may not exist yet — fine
                }
            }
        }

        Ok(remote_rows)
    }

    /// Phase 3: merge downloaded data into DB (caller holds DB lock)
    pub fn apply_merge(
        db: &Connection,
        remote_rows: &[(String, Vec<Value>)],
    ) -> Result<(usize, usize), String> {
        let mut uploaded = 0usize;
        let mut downloaded = 0usize;

        for (table, rows) in remote_rows {
            if !rows.is_empty() {
                uploaded += 1; // each file counts as one upload
            }
            for row in rows {
                if merge_row(db, table, row).is_ok() {
                    downloaded += 1;
                }
            }
        }

        // Update sync meta for all synced tables
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        for table in SYNC_TABLES {
            db.execute(
                "INSERT OR REPLACE INTO sync_meta (table_name, last_synced_at) VALUES (?1, ?2)",
                rusqlite::params![*table, now],
            )
            .map_err(|e| e.to_string())?;
        }

        Ok((uploaded, downloaded))
    }
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

fn merge_row(db: &Connection, table: &str, row: &Value) -> Result<(), String> {
    match table {
        "books" => {
            let id = row["id"].as_str().unwrap_or("");
            if id.is_empty() {
                return Ok(());
            }
            let remote_updated = row["updated_at"].as_i64().unwrap_or(0);

            let local_updated: Option<i64> = db
                .query_row(
                    "SELECT updated_at FROM books WHERE id = ?1",
                    rusqlite::params![id],
                    |r| r.get(0),
                )
                .ok();

            if local_updated.is_none_or(|lu| lu < remote_updated) {
                db.execute(
                    "INSERT OR REPLACE INTO books (id, title, author, format, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5)",
                    rusqlite::params![
                        id,
                        row["title"].as_str().unwrap_or(""),
                        row["author"].as_str().unwrap_or(""),
                        row["format"].as_str().unwrap_or(""),
                        remote_updated,
                    ],
                )
                .map_err(|e| e.to_string())?;
            }
        }
        "reading_progress" => {
            let book_id = row["book_id"].as_str().unwrap_or("");
            let remote_updated = row["updated_at"].as_i64().unwrap_or(0);

            let local_updated: Option<i64> = db
                .query_row(
                    "SELECT updated_at FROM reading_progress WHERE book_id = ?1",
                    rusqlite::params![book_id],
                    |r| r.get(0),
                )
                .ok();

            if local_updated.is_none_or(|lu| lu < remote_updated) {
                db.execute(
                    "INSERT OR REPLACE INTO reading_progress (book_id, chapter_index, position, updated_at)
                     VALUES (?1, ?2, ?3, ?4)",
                    rusqlite::params![
                        book_id,
                        row["chapter_index"].as_i64().unwrap_or(0),
                        row["position"].as_f64().unwrap_or(0.0),
                        remote_updated,
                    ],
                )
                .map_err(|e| e.to_string())?;
            }
        }
        "bookmarks" => {
            let id = row["id"].as_str().unwrap_or("");
            let remote_created = row["created_at"].as_i64().unwrap_or(0);

            let exists: bool = db
                .query_row(
                    "SELECT COUNT(*) > 0 FROM bookmarks WHERE id = ?1",
                    rusqlite::params![id],
                    |r| r.get(0),
                )
                .unwrap_or(false);

            if !exists {
                db.execute(
                    "INSERT OR IGNORE INTO bookmarks (id, book_id, chapter_index, position, label, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    rusqlite::params![
                        id,
                        row["book_id"].as_str().unwrap_or(""),
                        row["chapter_index"].as_i64().unwrap_or(0),
                        row["position"].as_f64().unwrap_or(0.0),
                        row["label"].as_str().unwrap_or(""),
                        remote_created,
                    ],
                )
                .map_err(|e| e.to_string())?;
            }
        }
        "annotations" => {
            let id = row["id"].as_str().unwrap_or("");
            let remote_updated = row["updated_at"].as_i64().unwrap_or(0);

            let local_updated: Option<i64> = db
                .query_row(
                    "SELECT updated_at FROM annotations WHERE id = ?1",
                    rusqlite::params![id],
                    |r| r.get(0),
                )
                .ok();

            if local_updated.is_none_or(|lu| lu < remote_updated) {
                db.execute(
                    "INSERT OR REPLACE INTO annotations (id, book_id, text, note, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5)",
                    rusqlite::params![
                        id,
                        row["book_id"].as_str().unwrap_or(""),
                        row["text"].as_str().unwrap_or(""),
                        row["note"].as_str().unwrap_or(""),
                        remote_updated,
                    ],
                )
                .map_err(|e| e.to_string())?;
            }
        }
        "book_sources" => {
            let id = row["id"].as_str().unwrap_or("");
            let remote_updated = row["updated_at"].as_i64().unwrap_or(0);

            let local_updated: Option<i64> = db
                .query_row(
                    "SELECT updated_at FROM book_sources WHERE id = ?1",
                    rusqlite::params![id],
                    |r| r.get(0),
                )
                .ok();

            if local_updated.is_none_or(|lu| lu < remote_updated) {
                db.execute(
                    "INSERT OR REPLACE INTO book_sources (id, name, base_url, updated_at)
                     VALUES (?1, ?2, ?3, ?4)",
                    rusqlite::params![
                        id,
                        row["name"].as_str().unwrap_or(""),
                        row["base_url"].as_str().unwrap_or(""),
                        remote_updated,
                    ],
                )
                .map_err(|e| e.to_string())?;
            }
        }
        _ => {}
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use serde_json::json;

    fn test_db() -> Connection {
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch(
            "CREATE TABLE IF NOT EXISTS books (
                id TEXT PRIMARY KEY, title TEXT, author TEXT,
                format TEXT, updated_at INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS reading_progress (
                book_id TEXT PRIMARY KEY, chapter_index INTEGER,
                position REAL, updated_at INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS bookmarks (
                id TEXT PRIMARY KEY, book_id TEXT, chapter_index INTEGER,
                position REAL, label TEXT, created_at INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS annotations (
                id TEXT PRIMARY KEY, book_id TEXT, text TEXT,
                note TEXT, updated_at INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS book_sources (
                id TEXT PRIMARY KEY, name TEXT,
                base_url TEXT, updated_at INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS sync_meta (
                table_name TEXT PRIMARY KEY, last_synced_at INTEGER DEFAULT 0
            );",
        )
        .unwrap();
        db
    }

    #[test]
    fn test_merge_row_rejects_empty_id() {
        let db = test_db();
        let row =
            json!({"id": "", "title": "Test", "author": "", "format": "txt", "updated_at": 1000});
        let result = merge_row(&db, "books", &row);
        assert!(result.is_ok());
        // Should not insert — ID was empty
        let count: i64 = db
            .query_row("SELECT COUNT(*) FROM books", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn test_merge_row_inserts_valid_book() {
        let db = test_db();
        let row = json!({"id": "book-1", "title": "My Book", "author": "Author", "format": "epub", "updated_at": 2000});
        merge_row(&db, "books", &row).unwrap();
        let count: i64 = db
            .query_row("SELECT COUNT(*) FROM books", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_merge_row_respects_newer_local() {
        let db = test_db();
        db.execute(
            "INSERT INTO books (id, title, updated_at) VALUES ('book-1', 'Old Title', 5000)",
            [],
        )
        .unwrap();

        let row = json!({"id": "book-1", "title": "Newer Remote?", "author": "", "format": "epub", "updated_at": 3000});
        merge_row(&db, "books", &row).unwrap();

        let title: String = db
            .query_row("SELECT title FROM books WHERE id = 'book-1'", [], |r| {
                r.get(0)
            })
            .unwrap();
        // Local is newer (5000 > 3000), so title should NOT be overwritten
        assert_eq!(title, "Old Title");
    }

    #[test]
    fn test_merge_row_applies_newer_remote() {
        let db = test_db();
        db.execute(
            "INSERT INTO books (id, title, updated_at) VALUES ('book-1', 'Old', 1000)",
            [],
        )
        .unwrap();

        let row = json!({"id": "book-1", "title": "Updated", "author": "", "format": "epub", "updated_at": 3000});
        merge_row(&db, "books", &row).unwrap();

        let title: String = db
            .query_row("SELECT title FROM books WHERE id = 'book-1'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(title, "Updated");
    }

    #[test]
    fn test_merge_row_reading_progress() {
        let db = test_db();
        let row =
            json!({"book_id": "b1", "chapter_index": 5, "position": 0.75, "updated_at": 2000});
        merge_row(&db, "reading_progress", &row).unwrap();

        let idx: i64 = db
            .query_row(
                "SELECT chapter_index FROM reading_progress WHERE book_id = 'b1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(idx, 5);
    }

    #[test]
    fn test_merge_row_bookmarks_avoids_duplicates() {
        let db = test_db();
        let row = json!({"id": "bm-1", "book_id": "b1", "chapter_index": 3, "position": 0.5, "label": "test", "created_at": 1000});
        merge_row(&db, "bookmarks", &row).unwrap();

        // Try again with same ID
        let row2 = json!({"id": "bm-1", "book_id": "b1", "chapter_index": 3, "position": 0.5, "label": "test2", "created_at": 2000});
        merge_row(&db, "bookmarks", &row2).unwrap();

        let count: i64 = db
            .query_row("SELECT COUNT(*) FROM bookmarks", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }
}
