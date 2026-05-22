use crate::book;
use crate::db;
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
pub fn import_book(
    state: State<AppState>,
    file_path: String,
) -> Result<ImportResult, String> {
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
        .extract_cover(&path, &cover_output.parent().map(|p| p.to_path_buf()).unwrap_or_else(|| PathBuf::from(".")))
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
        message: format!("Successfully imported {}", path.file_name().unwrap_or_default().to_string_lossy()),
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
pub fn get_chapters(
    state: State<AppState>,
    book_id: String,
) -> Result<Vec<ChapterItem>, String> {
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
