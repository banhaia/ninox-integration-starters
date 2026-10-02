import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { runMigrations } from "./migrate.js";

export type Db = Database.Database;

/**
 * Abre (o crea) la base SQLite y aplica las migraciones pendientes.
 * Usar ":memory:" en tests.
 */
export function openDatabase(file: string): Db {
  if (file !== ":memory:") {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }

  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  runMigrations(db);
  return db;
}

export function nowIso(): string {
  return new Date().toISOString();
}
