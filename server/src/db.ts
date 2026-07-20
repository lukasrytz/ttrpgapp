import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export function openDb(dataDir: string): Database.Database {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, 'app.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tracks (
      id INTEGER PRIMARY KEY,
      folder TEXT NOT NULL,
      path TEXT NOT NULL,
      title TEXT NOT NULL,
      artist TEXT,
      duration_sec REAL,
      intensity INTEGER,
      UNIQUE (folder, path)
    );

    CREATE TABLE IF NOT EXISTS track_tags (
      track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      dimension TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (track_id, dimension, value)
    );

    -- generic per-plugin key/value state (e.g. tracker encounters)
    CREATE TABLE IF NOT EXISTS plugin_state (
      plugin_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (plugin_id, key)
    );
  `);
}
