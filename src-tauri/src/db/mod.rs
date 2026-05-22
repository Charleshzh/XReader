#![allow(dead_code)]
pub mod models;
pub mod queries;

use rusqlite::Connection;
use std::path::PathBuf;

mod embedded {
    use refinery::embed_migrations;
    embed_migrations!("src/db/migrations");
}

/// Initialise database and run migrations.
/// `db_dir` is the directory where the SQLite file will be stored (e.g. app data dir).
pub fn init(db_dir: &str) -> Result<Connection, Box<dyn std::error::Error>> {
    std::fs::create_dir_all(db_dir)?;
    let db_path = PathBuf::from(db_dir).join("xreader.db");
    let mut conn = Connection::open(&db_path)?;

    // Enable WAL mode for better concurrent read performance
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;

    // Run refinery migrations
    let runner = embedded::migrations::runner();
    runner.run(&mut conn)?;

    Ok(conn)
}
