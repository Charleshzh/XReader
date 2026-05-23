from __future__ import annotations

import argparse
import pathlib
import sqlite3


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--migration", required=True)
    parser.add_argument("--db", required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    migration_path = pathlib.Path(args.migration)
    db_path = pathlib.Path(args.db)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    schema_sql = migration_path.read_text(encoding="utf-8")
    connection = sqlite3.connect(db_path)
    try:
        connection.executescript(schema_sql)
        connection.executescript(
            """
            CREATE TABLE refinery_schema_history(
                version INT4 PRIMARY KEY,
                name VARCHAR(255),
                applied_on VARCHAR(255),
                checksum VARCHAR(255)
            );
            """
        )
        connection.execute(
            """
            INSERT INTO refinery_schema_history (version, name, applied_on, checksum)
            VALUES (?, ?, ?, ?)
            """,
            (1, "initial_schema", "2026-05-22T00:00:00Z", "0"),
        )
        connection.commit()
    finally:
        connection.close()


if __name__ == "__main__":
    main()
