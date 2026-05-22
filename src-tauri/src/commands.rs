use crate::book;
use crate::db;
use crate::sync::types::SyncBackend;
use crate::AppState;
use rusqlite::Connection;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

/// Metadata returned to frontend after importing a book.
#[derive(serde::Serialize)]
pub struct ImportResult {
    pub id: String,
    pub title: String,
    pub author: String,
    pub cover_path: String,
    pub format: String,
    pub total_chapters: usize,
    pub message: String,
}

#[tauri::command]
pub fn import_book(state: State<AppState>, file_path: String) -> Result<ImportResult, String> {
    let path = PathBuf::from(&file_path);

    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    let registry = book::create_registry();
    let format = registry
        .find_for(&path)
        .ok_or_else(|| format!("Unsupported file format: {}", file_path))?;

    let db = state.db.lock().map_err(|e| e.to_string())?;

    // Check for duplicates
    if db::queries::book_exists_by_path(&db, &file_path).map_err(|e| e.to_string())? {
        return Err("This book has already been imported.".to_string());
    }

    // Parse metadata
    let meta = format
        .parse(&path)
        .map_err(|e| format!("Failed to parse book: {}", e))?;

    // Generate ID and timestamp
    let id = uuid::Uuid::new_v4().to_string();
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    // Extract cover to app data directory
    let cover_dir = format!(
        "{}/covers",
        directories::ProjectDirs::from("com", "xreader", "XReader")
            .map(|d| d.data_dir().to_path_buf())
            .unwrap_or_else(|| PathBuf::from("./xreader_data"))
            .display()
    );
    fs::create_dir_all(&cover_dir).map_err(|e| e.to_string())?;

    let cover_filename = format!("{}.cover", id);
    let cover_path = cover_dir.clone() + "/" + &cover_filename;
    let cover_output = PathBuf::from(&cover_path);

    let cover_result = format
        .extract_cover(
            &path,
            &cover_output
                .parent()
                .map(|p| p.to_path_buf())
                .unwrap_or_else(|| PathBuf::from(".")),
        )
        .map_err(|e| format!("Failed to extract cover: {}", e))?;

    let cover_path_str = cover_result
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    // Insert into DB
    let book_record = db::models::Book {
        id: id.clone(),
        title: meta.title.clone(),
        author: meta.author.clone(),
        cover_path: cover_path_str.clone(),
        file_path: file_path.clone(),
        format: meta.format.clone(),
        source_type: "local".into(),
        source_id: String::new(),
        source_url: String::new(),
        total_chapters: meta.total_chapters as i64,
        created_at: now,
        updated_at: now,
    };
    db::queries::insert_book(&db, &book_record).map_err(|e| e.to_string())?;

    // Also store chapters if needed (for remote books in later phases)
    let chapters = format
        .get_chapters(&path)
        .map_err(|e| format!("Failed to get chapters: {}", e))?;
    for (i, ch) in chapters.iter().enumerate() {
        db.execute(
            "INSERT OR IGNORE INTO chapters (id, book_id, index_num, title, url, content_path, word_count, fetched)
             VALUES (?1, ?2, ?3, ?4, '', '', 0, 0)",
            rusqlite::params![
                format!("{}-{}", id, i),
                id,
                ch.index,
                ch.title,
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(ImportResult {
        id,
        title: meta.title,
        author: meta.author,
        cover_path: cover_path_str,
        format: meta.format,
        total_chapters: meta.total_chapters,
        message: format!(
            "Successfully imported {}",
            path.file_name().unwrap_or_default().to_string_lossy()
        ),
    })
}

#[tauri::command]
pub fn list_books(state: State<AppState>) -> Result<Vec<db::queries::BookListItem>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let books = db::queries::list_books(&db).map_err(|e| e.to_string())?;
    Ok(books.into_iter().map(|b| b.into()).collect())
}

#[tauri::command]
pub fn delete_book(state: State<AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::queries::delete_book(&db, &id).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_chapter_content(
    state: State<AppState>,
    book_id: String,
    chapter_index: usize,
) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let book = db::queries::get_book(&db, &book_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Book not found".to_string())?;

    let path = PathBuf::from(&book.file_path);
    let registry = book::create_registry();
    let format = registry
        .find_for(&path)
        .ok_or_else(|| "Unsupported format".to_string())?;

    let chapters = format
        .get_chapters(&path)
        .map_err(|e| format!("Failed to load chapters: {}", e))?;

    let chapter = chapters
        .get(chapter_index)
        .ok_or_else(|| "Chapter not found".to_string())?;

    format
        .read_chapter(&path, chapter)
        .map_err(|e| format!("Failed to read chapter: {}", e))
}

#[derive(serde::Serialize)]
pub struct ChapterItem {
    pub index: usize,
    pub title: String,
}

#[tauri::command]
pub fn get_chapters(state: State<AppState>, book_id: String) -> Result<Vec<ChapterItem>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let book = db::queries::get_book(&db, &book_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Book not found".to_string())?;

    let path = PathBuf::from(&book.file_path);
    let registry = book::create_registry();
    let format = registry
        .find_for(&path)
        .ok_or_else(|| "Unsupported format".to_string())?;

    let chapters = format
        .get_chapters(&path)
        .map_err(|e| format!("Failed to load chapters: {}", e))?;

    Ok(chapters
        .into_iter()
        .map(|c| ChapterItem {
            index: c.index,
            title: c.title,
        })
        .collect())
}

#[tauri::command]
pub fn save_progress(
    state: State<AppState>,
    book_id: String,
    chapter_index: i64,
    position: f64,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    db.execute(
        "INSERT INTO reading_progress (book_id, chapter_index, position, updated_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(book_id) DO UPDATE SET chapter_index = ?2, position = ?3, updated_at = ?4",
        rusqlite::params![book_id, chapter_index, position, now],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Bookmarks ──

#[derive(serde::Serialize)]
pub struct BookmarkItem {
    pub id: String,
    pub book_id: String,
    pub chapter_index: i64,
    pub position: f64,
    pub label: String,
    pub created_at: i64,
}

#[tauri::command]
pub fn add_bookmark(
    state: State<AppState>,
    book_id: String,
    chapter_index: i64,
    position: f64,
    label: String,
) -> Result<BookmarkItem, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    db.execute(
        "INSERT INTO bookmarks (id, book_id, chapter_index, position, label, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![id, book_id, chapter_index, position, label, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(BookmarkItem {
        id,
        book_id,
        chapter_index,
        position,
        label,
        created_at: now,
    })
}

#[tauri::command]
pub fn list_bookmarks(
    state: State<AppState>,
    book_id: String,
) -> Result<Vec<BookmarkItem>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT id, book_id, chapter_index, position, label, created_at
             FROM bookmarks WHERE book_id = ?1 ORDER BY chapter_index, position",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![book_id], |row| {
            Ok(BookmarkItem {
                id: row.get(0)?,
                book_id: row.get(1)?,
                chapter_index: row.get(2)?,
                position: row.get(3)?,
                label: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut items = Vec::new();
    for row in rows {
        items.push(row.map_err(|e| e.to_string())?);
    }
    Ok(items)
}

#[tauri::command]
pub fn delete_bookmark(state: State<AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM bookmarks WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Annotations ──

#[derive(serde::Serialize, serde::Deserialize)]
pub struct AnnotationItem {
    pub id: String,
    pub book_id: String,
    pub chapter_index: i64,
    pub start_position: f64,
    pub end_position: f64,
    pub text: String,
    pub note: String,
    pub color: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub fn add_annotation(
    state: State<AppState>,
    book_id: String,
    chapter_index: i64,
    start_position: f64,
    end_position: f64,
    text: String,
    note: String,
    color: String,
) -> Result<AnnotationItem, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    db.execute(
        "INSERT INTO annotations (id, book_id, chapter_index, start_position, end_position, text, note, color, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        rusqlite::params![id, book_id, chapter_index, start_position, end_position, text, note, color, now, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(AnnotationItem {
        id,
        book_id,
        chapter_index,
        start_position,
        end_position,
        text,
        note,
        color,
        created_at: now,
        updated_at: now,
    })
}

#[tauri::command]
pub fn update_annotation_note(
    state: State<AppState>,
    id: String,
    note: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    db.execute(
        "UPDATE annotations SET note = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![note, now, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn list_annotations(
    state: State<AppState>,
    book_id: String,
    chapter_index: i64,
) -> Result<Vec<AnnotationItem>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT id, book_id, chapter_index, start_position, end_position, text, note, color, created_at, updated_at
             FROM annotations WHERE book_id = ?1 AND chapter_index = ?2 ORDER BY start_position",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![book_id, chapter_index], |row| {
            Ok(AnnotationItem {
                id: row.get(0)?,
                book_id: row.get(1)?,
                chapter_index: row.get(2)?,
                start_position: row.get(3)?,
                end_position: row.get(4)?,
                text: row.get(5)?,
                note: row.get(6)?,
                color: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut items = Vec::new();
    for row in rows {
        items.push(row.map_err(|e| e.to_string())?);
    }
    Ok(items)
}

#[tauri::command]
pub fn delete_annotation(state: State<AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "DELETE FROM annotations WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Reading Stats ──

#[derive(serde::Serialize)]
pub struct StatsSummary {
    pub total_seconds: i64,
    pub total_words: i64,
    pub daily: Vec<DailyStats>,
}

#[derive(serde::Serialize)]
pub struct DailyStats {
    pub date: String,
    pub read_seconds: i64,
    pub read_words: i64,
}

#[tauri::command]
pub fn log_reading_session(
    state: State<AppState>,
    book_id: String,
    date: String,
    seconds: i64,
    words: i64,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT INTO reading_stats (book_id, date, read_seconds, read_words)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(book_id, date) DO UPDATE SET
           read_seconds = read_seconds + ?3,
           read_words = read_words + ?4",
        rusqlite::params![book_id, date, seconds, words],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_reading_stats(state: State<AppState>, days: i64) -> Result<StatsSummary, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    // Aggregate totals
    let total_seconds: i64 = db
        .query_row(
            "SELECT COALESCE(SUM(read_seconds), 0) FROM reading_stats",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let total_words: i64 = db
        .query_row(
            "SELECT COALESCE(SUM(read_words), 0) FROM reading_stats",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    // Recent daily stats
    let mut stmt = db
        .prepare(
            "SELECT date, read_seconds, read_words FROM reading_stats
             ORDER BY date DESC LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![days], |row| {
            Ok(DailyStats {
                date: row.get(0)?,
                read_seconds: row.get(1)?,
                read_words: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut daily = Vec::new();
    for row in rows {
        daily.push(row.map_err(|e| e.to_string())?);
    }

    Ok(StatsSummary {
        total_seconds,
        total_words,
        daily,
    })
}

// ── Book Source Management ──

#[derive(serde::Serialize)]
pub struct SourceListItem {
    pub id: String,
    pub name: String,
    pub base_url: String,
    pub enabled: bool,
    pub created_at: i64,
}

#[tauri::command]
pub fn import_book_source(
    state: State<AppState>,
    json_str: String,
) -> Result<SourceListItem, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    // Parse JSON to extract name and base_url
    let json_val: serde_json::Value =
        serde_json::from_str(&json_str).map_err(|e| format!("Invalid JSON: {}", e))?;
    let name = json_val["bookSourceName"]
        .as_str()
        .unwrap_or("Unnamed Source")
        .to_string();
    let base_url = json_val["bookSourceUrl"].as_str().unwrap_or("").to_string();

    db.execute(
        "INSERT INTO book_sources (id, name, base_url, enabled, rule_json, created_at, updated_at)
         VALUES (?1, ?2, ?3, 1, ?4, ?5, ?6)",
        rusqlite::params![id, name, base_url, json_str, now, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(SourceListItem {
        id,
        name,
        base_url,
        enabled: true,
        created_at: now,
    })
}

#[tauri::command]
pub fn list_book_sources(state: State<AppState>) -> Result<Vec<SourceListItem>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT id, name, base_url, enabled, created_at FROM book_sources ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(SourceListItem {
                id: row.get(0)?,
                name: row.get(1)?,
                base_url: row.get(2)?,
                enabled: row.get::<_, i64>(3)? != 0,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_book_source(state: State<AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "DELETE FROM book_sources WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(serde::Serialize)]
pub struct SearchBookResult {
    pub name: String,
    pub author: String,
    pub cover_url: String,
    pub intro: String,
    pub book_url: String,
}

#[tauri::command]
pub async fn search_books(
    state: State<'_, AppState>,
    source_id: String,
    keyword: String,
    page: u32,
) -> Result<Vec<SearchBookResult>, String> {
    let json_str: String = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.query_row(
            "SELECT rule_json FROM book_sources WHERE id = ?1",
            rusqlite::params![source_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?
    };

    let json_val: serde_json::Value =
        serde_json::from_str(&json_str).map_err(|e| format!("Invalid source JSON: {}", e))?;
    let compiled = crate::source::compile_source(&json_val).map_err(|e| e.to_string())?;
    let mut pipeline = crate::source::SourcePipeline::new(compiled);

    let results = pipeline
        .search(&keyword, page)
        .await
        .map_err(|e| e.to_string())?;

    Ok(results
        .into_iter()
        .map(|r| SearchBookResult {
            name: r.name,
            author: r.author,
            cover_url: r.cover_url,
            intro: r.intro,
            book_url: r.book_url,
        })
        .collect())
}

// ── Cloud Sync ──

#[tauri::command]
pub async fn sync_now(state: State<'_, AppState>) -> Result<crate::sync::SyncResult, String> {
    let config = load_sync_config(&state).map_err(|e| e.to_string())?;
    let backend = crate::sync::webdav::WebDavBackend::new(
        config.url.clone(),
        config.username.clone(),
        config.password.clone(),
    );

    backend
        .check_connection()
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    // All sync operations at MVP level: just upload a backup
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    Ok(crate::sync::SyncResult {
        uploaded: 1,
        downloaded: 0,
        conflicts: 0,
        errors: Vec::new(),
        timestamp: now,
    })
}

#[tauri::command]
pub fn configure_sync(state: State<AppState>, config: serde_json::Value) -> Result<(), String> {
    let json_str = serde_json::to_string(&config).map_err(|e| e.to_string())?;
    let db = state.db.lock().map_err(|e| e.to_string())?;
    crate::db::queries::set_setting(&db, "sync_config", &json_str).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_sync_config(state: State<AppState>) -> Result<serde_json::Value, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let json_str = crate::db::queries::get_setting(&db, "sync_config")
        .map_err(|e| e.to_string())?
        .unwrap_or_default();
    serde_json::from_str(&json_str).map_err(|e| e.to_string())
}

fn load_sync_config(state: &State<AppState>) -> Result<crate::sync::types::SyncConfig, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let json_str = crate::db::queries::get_setting(&db, "sync_config")
        .map_err(|e| e.to_string())?
        .unwrap_or_default();
    if json_str.is_empty() {
        return Ok(Default::default());
    }
    serde_json::from_str(&json_str).map_err(|e| e.to_string())
}

// ── Reader Settings Persistence ──

#[tauri::command]
pub fn save_reader_settings(state: State<AppState>, settings_json: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    crate::db::queries::set_setting(&db, "reader_settings", &settings_json)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_reader_settings(state: State<AppState>) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    crate::db::queries::get_setting(&db, "reader_settings")
        .map_err(|e| e.to_string())
        .map(|v| v.unwrap_or_default())
}
