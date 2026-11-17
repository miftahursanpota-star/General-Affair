import { DatabaseSync } from 'node:sqlite';
import { createClient } from '@libsql/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dumpPath = resolve(process.argv[2] || '.private/d1-export.sql');
const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env;

if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
  throw new Error('Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env first.');
}

const exportSql = readFileSync(dumpPath, 'utf8');
const source = new DatabaseSync(':memory:');
source.exec(exportSql);

const target = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });
const quoteIdentifier = (identifier) => `"${identifier.replaceAll('"', '""')}"`;

try {
  const tableCount = await target.execute(
    "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
  );
  if (Number(tableCount.rows[0]?.count || 0) !== 0) {
    throw new Error('The Turso database is not empty. Use a new database for this import.');
  }

  const objects = source.prepare(`
    SELECT type, name, sql
    FROM sqlite_master
    WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
    ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END
  `).all();
  const tables = objects.filter((object) => object.type === 'table');

  await target.batch(objects.map(({ sql }) => ({ sql })), 'write');

  for (const { name } of tables) {
    const table = quoteIdentifier(name);
    const columns = source.prepare(`PRAGMA table_info(${table})`).all().map(({ name: column }) => column);
    const columnList = columns.map(quoteIdentifier).join(', ');
    const placeholders = columns.map(() => '?').join(', ');
    const insertSql = `INSERT INTO ${table} (${columnList}) VALUES (${placeholders})`;
    let batch = [];
    let rowCount = 0;

    for (const row of source.prepare(`SELECT * FROM ${table}`).iterate()) {
      batch.push({ sql: insertSql, args: columns.map((column) => row[column]) });
      rowCount += 1;

      if (batch.length === 100) {
        await target.batch(batch, 'write');
        batch = [];
      }
    }

    if (batch.length > 0) await target.batch(batch, 'write');

    const imported = await target.execute(`SELECT COUNT(*) AS count FROM ${table}`);
    if (Number(imported.rows[0]?.count || 0) !== rowCount) {
      throw new Error(`Row count verification failed for table ${name}.`);
    }
    console.log(`${name}: ${rowCount} rows verified`);
  }
} finally {
  source.close();
  await target.close();
}