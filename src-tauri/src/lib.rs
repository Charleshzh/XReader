#![allow(dead_code)]
#![allow(unused_imports)]
#![allow(
    clippy::manual_strip,
    clippy::redundant_closure,
    clippy::unnecessary_unwrap,
    clippy::len_zero,
    clippy::iter_next_slice,
    clippy::field_reassign_with_default,
    clippy::question_mark
)]

mod book;
mod commands;
mod db;
mod source;
mod sync;

use std::sync::Mutex;

pub struct AppState {
    pub db: Mutex<rusqlite::Connection>,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! XReader is running.", name)
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();
    log::info!("XReader v{} starting", env!("CARGO_PKG_VERSION"));

    let app_dir = directories::ProjectDirs::from("com", "xreader", "XReader")
        .map(|d| d.data_dir().to_path_buf())
        .unwrap_or_else(|| std::path::PathBuf::from("./xreader_data"));
    let db_dir = app_dir.to_string_lossy().to_string();

    let conn = db::init(&db_dir).expect("Failed to initialize database");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(AppState {
            db: Mutex::new(conn),
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_app_version,
            commands::import_book,
            commands::list_books,
            commands::delete_book,
            commands::get_chapter_content,
            commands::get_chapters,
            commands::save_progress,
            commands::add_bookmark,
            commands::list_bookmarks,
            commands::delete_bookmark,
            commands::add_annotation,
            commands::update_annotation_note,
            commands::list_annotations,
            commands::delete_annotation,
            commands::log_reading_session,
            commands::get_reading_stats,
            commands::import_book_source,
            commands::list_book_sources,
            commands::delete_book_source,
            commands::search_books,
            commands::sync_now,
            commands::configure_sync,
            commands::get_sync_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
