use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

use super::models::{Book, Chapter};

/// List all books ordered by most recently updated.
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

/// Get a single book by ID.
pub fn get_book(conn: &Connection, id: &str) -> Result<Option<Book>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, author, cover_path, file_path, format,
                source_type, source_id, source_url, total_chapters,
                created_at, updated_at
         FROM books WHERE id = ?1",
    )?;
    let mut rows = stmt.query_map(params![id], |row| {
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
    match rows.next() {
        Some(val) => val.map(Some),
        None => Ok(None),
    }
}

/// Insert a new book record.
pub fn insert_book(conn: &Connection, book: &Book) -> Result<()> {
    conn.execute(
        "INSERT INTO books (id, title, author, cover_path, file_path, format,
                            source_type, source_id, source_url, total_chapters,
                            created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            book.id,
            book.title,
            book.author,
            book.cover_path,
            book.file_path,
            book.format,
            book.source_type,
            book.source_id,
            book.source_url,
            book.total_chapters,
            book.created_at,
            book.updated_at,
        ],
    )?;
    Ok(())
}

/// Delete a book by ID.
pub fn delete_book(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM books WHERE id = ?1", params![id])?;
    Ok(())
}

/// Check if a book with the given file_path already exists.
pub fn book_exists_by_path(conn: &Connection, path: &str) -> Result<bool> {
    let mut stmt = conn.prepare("SELECT COUNT(*) FROM books WHERE file_path = ?1")?;
    let count: i64 = stmt.query_row(params![path], |row| row.get(0))?;
    Ok(count > 0)
}

pub fn list_remote_chapters(conn: &Connection, book_id: &str) -> Result<Vec<Chapter>> {
    let mut stmt = conn.prepare(
        "SELECT id, book_id, index_num, title, url, content_path, word_count, fetched
         FROM chapters WHERE book_id = ?1 ORDER BY index_num ASC",
    )?;
    let rows = stmt.query_map(params![book_id], |row| {
        Ok(Chapter {
            id: row.get(0)?,
            book_id: row.get(1)?,
            index_num: row.get(2)?,
            title: row.get(3)?,
            url: row.get(4)?,
            content_path: row.get(5)?,
            word_count: row.get(6)?,
            fetched: row.get::<_, i64>(7)? != 0,
        })
    })?;
    rows.collect()
}

pub fn get_remote_chapter(
    conn: &Connection,
    book_id: &str,
    index_num: i64,
) -> Result<Option<Chapter>> {
    let mut stmt = conn.prepare(
        "SELECT id, book_id, index_num, title, url, content_path, word_count, fetched
         FROM chapters WHERE book_id = ?1 AND index_num = ?2",
    )?;
    let mut rows = stmt.query_map(params![book_id, index_num], |row| {
        Ok(Chapter {
            id: row.get(0)?,
            book_id: row.get(1)?,
            index_num: row.get(2)?,
            title: row.get(3)?,
            url: row.get(4)?,
            content_path: row.get(5)?,
            word_count: row.get(6)?,
            fetched: row.get::<_, i64>(7)? != 0,
        })
    })?;
    match rows.next() {
        Some(value) => value.map(Some),
        None => Ok(None),
    }
}

pub fn upsert_remote_chapter(conn: &Connection, chapter: &Chapter) -> Result<()> {
    conn.execute(
        "INSERT INTO chapters (id, book_id, index_num, title, url, content_path, word_count, fetched)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(book_id, index_num) DO UPDATE SET
           title = excluded.title,
           url = excluded.url,
           content_path = excluded.content_path,
           word_count = excluded.word_count,
           fetched = excluded.fetched",
        params![
            chapter.id,
            chapter.book_id,
            chapter.index_num,
            chapter.title,
            chapter.url,
            chapter.content_path,
            chapter.word_count,
            chapter.fetched as i64,
        ],
    )?;
    Ok(())
}

pub fn update_remote_chapter_content(
    conn: &Connection,
    book_id: &str,
    index_num: i64,
    content_path: &str,
    word_count: i64,
) -> Result<()> {
    conn.execute(
        "UPDATE chapters
         SET content_path = ?3, word_count = ?4, fetched = 1
         WHERE book_id = ?1 AND index_num = ?2",
        params![book_id, index_num, content_path, word_count],
    )?;
    Ok(())
}

/// Insert or update an app setting.
pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO app_settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = ?2",
        params![key, value],
    )?;
    Ok(())
}

/// Get an app setting value.
pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>> {
    let mut stmt = conn.prepare("SELECT value FROM app_settings WHERE key = ?1")?;
    let mut rows = stmt.query_map(params![key], |row| row.get(0))?;
    match rows.next() {
        Some(val) => val.map(Some),
        None => Ok(None),
    }
}

/// Simple book info returned to frontend for list display.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookListItem {
    pub id: String,
    pub title: String,
    pub author: String,
    pub cover_path: String,
    pub format: String,
    pub file_path: String,
    pub total_chapters: i64,
    pub updated_at: i64,
    pub source_type: String,
    pub source_id: String,
    pub source_url: String,
}

impl From<Book> for BookListItem {
    fn from(b: Book) -> Self {
        Self {
            id: b.id,
            title: b.title,
            author: b.author,
            file_path: b.file_path,
            cover_path: b.cover_path,
            format: b.format,
            total_chapters: b.total_chapters,
            updated_at: b.updated_at,
            source_type: b.source_type,
            source_id: b.source_id,
            source_url: b.source_url,
        }
    }
}
