use rusqlite::{params, Connection, Result};

use super::models::Book;

/// List all books ordered by most recently updated
pub fn list_books(conn: &Connection) -> Result<Vec<Book>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, author, cover_path, file_path, format,
                source_type, source_id, source_url, total_chapters,
                created_at, updated_at
         FROM books ORDER BY updated_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Book {
            id: row.get(0)?,
            title: row.get(1)?,
            author: row.get(2)?,
            cover_path: row.get(3)?,
            file_path: row.get(4)?,
            format: row.get(5)?,
            source_type: row.get(6)?,
            source_id: row.get(7)?,
            source_url: row.get(8)?,
            total_chapters: row.get(9)?,
            created_at: row.get(10)?,
            updated_at: row.get(11)?,
        })
    })?;
    rows.collect()
}

/// Insert or update an app setting
pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO app_settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = ?2",
        params![key, value],
    )?;
    Ok(())
}

/// Get an app setting value
pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>> {
    let mut stmt = conn.prepare("SELECT value FROM app_settings WHERE key = ?1")?;
    let mut rows = stmt.query_map(params![key], |row| row.get(0))?;
    match rows.next() {
        Some(val) => val.map(Some),
        None => Ok(None),
    }
}
