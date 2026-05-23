#![allow(dead_code)]
pub mod models;
pub mod queries;

use refinery::Migration;
use refinery_core::error::Kind as RefineryErrorKind;
use rusqlite::{params, Connection};
use std::path::PathBuf;

mod embedded {
    use refinery::embed_migrations;
    embed_migrations!("src/db/migrations");
}

const INITIAL_SCHEMA_VERSION: u32 = 1;
const INITIAL_SCHEMA_NAME: &str = "initial_schema";
const INITIAL_SCHEMA_SQL: &str = include_str!("migrations/V1__initial_schema.sql");
const REFINERY_HISTORY_TABLE_SQL: &str = "
    CREATE TABLE refinery_schema_history(
        version INT4 PRIMARY KEY,
        name VARCHAR(255),
        applied_on VARCHAR(255),
        checksum VARCHAR(255)
    )
";
const REQUIRED_INITIAL_SCHEMA: &[(&str, &[&str])] = &[
    (
        "books",
        &[
            "id",
            "title",
            "author",
            "cover_path",
            "file_path",
            "format",
            "source_type",
            "source_id",
            "source_url",
            "total_chapters",
            "created_at",
            "updated_at",
        ],
    ),
    (
        "chapters",
        &[
            "id",
            "book_id",
            "index_num",
            "title",
            "url",
            "content_path",
            "word_count",
            "fetched",
        ],
    ),
    (
        "reading_progress",
        &["book_id", "chapter_index", "position", "updated_at"],
    ),
    (
        "bookmarks",
        &[
            "id",
            "book_id",
            "chapter_index",
            "position",
            "label",
            "created_at",
        ],
    ),
    (
        "annotations",
        &[
            "id",
            "book_id",
            "chapter_index",
            "start_position",
            "end_position",
            "text",
            "note",
            "color",
            "created_at",
            "updated_at",
        ],
    ),
    (
        "book_sources",
        &[
            "id",
            "name",
            "base_url",
            "enabled",
            "rule_json",
            "created_at",
            "updated_at",
        ],
    ),
    ("sync_meta", &["table_name", "last_synced_at", "version"]),
    (
        "reading_stats",
        &["id", "book_id", "date", "read_seconds", "read_words"],
    ),
    ("app_settings", &["key", "value"]),
];

/// Initialise database and run migrations.
/// `db_dir` is the directory where the SQLite file will be stored (e.g. app data dir).
pub fn init(db_dir: &str) -> Result<Connection, Box<dyn std::error::Error>> {
    std::fs::create_dir_all(db_dir)?;
    let db_path = PathBuf::from(db_dir).join("xreader.db");
    let mut conn = Connection::open(&db_path)?;

    // Enable WAL mode for better concurrent read performance
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;

    run_migrations(&mut conn)?;

    Ok(conn)
}

fn run_migrations(conn: &mut Connection) -> Result<(), Box<dyn std::error::Error>> {
    let runner = embedded::migrations::runner();
    match runner.run(conn) {
        Ok(_) => Ok(()),
        Err(error) => {
            if repair_initial_schema_checksum(conn, &runner, &error)? {
                runner.run(conn)?;
                return Ok(());
            }
            Err(Box::new(error))
        }
    }
}

fn repair_initial_schema_checksum(
    conn: &Connection,
    runner: &refinery::Runner,
    error: &refinery::Error,
) -> Result<bool, Box<dyn std::error::Error>> {
    let RefineryErrorKind::DivergentVersion(applied, pending) = error.kind() else {
        return Ok(false);
    };

    if applied.version() != INITIAL_SCHEMA_VERSION
        || pending.version() != INITIAL_SCHEMA_VERSION
        || applied.name() != INITIAL_SCHEMA_NAME
        || pending.name() != INITIAL_SCHEMA_NAME
        || !matches_initial_schema(conn)?
    {
        return Ok(false);
    }

    let Some(current) = initial_schema_migration(runner.get_migrations()) else {
        return Ok(false);
    };

    conn.execute(
        "UPDATE refinery_schema_history SET checksum = ?1 WHERE version = ?2",
        params![current.checksum().to_string(), INITIAL_SCHEMA_VERSION],
    )?;

    log::warn!("Repaired V1 migration checksum drift after validating current schema");

    Ok(true)
}

fn matches_initial_schema(conn: &Connection) -> Result<bool, rusqlite::Error> {
    for (table, columns) in REQUIRED_INITIAL_SCHEMA {
        if !table_has_columns(conn, table, columns)? {
            return Ok(false);
        }
    }
    Ok(true)
}

fn table_has_columns(
    conn: &Connection,
    table: &str,
    expected_columns: &[&str],
) -> Result<bool, rusqlite::Error> {
    let mut statement = conn.prepare(&format!("PRAGMA table_info({table})"))?;
    let actual_columns = statement
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(!actual_columns.is_empty()
        && expected_columns
            .iter()
            .all(|expected| actual_columns.iter().any(|actual| actual == expected)))
}

fn initial_schema_migration(migrations: &[Migration]) -> Option<&Migration> {
    migrations.iter().find(|migration| {
        migration.version() == INITIAL_SCHEMA_VERSION && migration.name() == INITIAL_SCHEMA_NAME
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn init_repairs_initial_schema_checksum_drift() {
        let dir = tempdir().unwrap();
        seed_divergent_database(dir.path(), INITIAL_SCHEMA_SQL).unwrap();

        let conn = init(dir.path().to_str().unwrap()).unwrap();
        let repaired_checksum: String = conn
            .query_row(
                "SELECT checksum FROM refinery_schema_history WHERE version = 1",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(
            repaired_checksum,
            initial_schema_migration(embedded::migrations::runner().get_migrations())
                .unwrap()
                .checksum()
                .to_string(),
        );
    }

    #[test]
    fn init_rejects_incompatible_divergent_initial_schema() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("xreader.db");
        let conn = Connection::open(&db_path).unwrap();
        conn.execute_batch(
            "
            CREATE TABLE books (id TEXT PRIMARY KEY);
            CREATE TABLE refinery_schema_history(
                version INT4 PRIMARY KEY,
                name VARCHAR(255),
                applied_on VARCHAR(255),
                checksum VARCHAR(255)
            );
            INSERT INTO refinery_schema_history (version, name, applied_on, checksum)
            VALUES (1, 'initial_schema', '2026-05-22T00:00:00Z', '0');
            ",
        )
        .unwrap();
        drop(conn);

        let error = init(dir.path().to_str().unwrap()).unwrap_err();
        assert!(error.to_string().contains("applied migration"));
    }

    fn seed_divergent_database(
        dir: &std::path::Path,
        schema_sql: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let db_path = dir.join("xreader.db");
        let conn = Connection::open(&db_path)?;
        conn.execute_batch(schema_sql)?;
        conn.execute_batch(REFINERY_HISTORY_TABLE_SQL)?;
        conn.execute(
            "INSERT INTO refinery_schema_history (version, name, applied_on, checksum)
             VALUES (?1, ?2, ?3, ?4)",
            params![
                INITIAL_SCHEMA_VERSION,
                INITIAL_SCHEMA_NAME,
                "2026-05-22T00:00:00Z",
                "0"
            ],
        )?;
        Ok(())
    }
}
