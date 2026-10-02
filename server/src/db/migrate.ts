import type Database from "better-sqlite3";
import { migrations } from "./migrations.js";

/**
 * Aplica en orden las migraciones que todavía no figuran en schema_migrations.
 * Cada migración corre dentro de una transacción. Las migraciones son solo hacia
 * adelante: para cambiar el esquema se agrega una nueva, nunca se edita una aplicada.
 */
export function runMigrations(db: Database.Database): string[] {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);

  const applied = new Set(
    db
      .prepare("SELECT id FROM schema_migrations")
      .all()
      .map((row) => (row as { id: number }).id)
  );

  const insert = db.prepare("INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)");
  const appliedNow: string[] = [];

  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;

    db.transaction(() => {
      db.exec(migration.sql);
      insert.run(migration.id, migration.name, new Date().toISOString());
    })();

    appliedNow.push(migration.name);
  }

  return appliedNow;
}
