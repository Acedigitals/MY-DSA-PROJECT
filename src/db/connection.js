import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const projectRoot = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
export const defaultDatabasePath = path.join(projectRoot, 'data', 'ticketing.sqlite');
const schemaPath = fileURLToPath(new URL('./schema.sql', import.meta.url));

export function createDatabase(filename = process.env.DB_PATH ?? defaultDatabasePath) {
  if (filename !== ':memory:') mkdirSync(path.dirname(filename), { recursive: true });
  const database = new DatabaseSync(filename);
  database.exec(readFileSync(schemaPath, 'utf8'));
  database.exec('PRAGMA foreign_keys = ON');
  return database;
}
