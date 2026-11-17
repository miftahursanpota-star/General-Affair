import { createClient } from '@tursodatabase/serverless/compat';

let client;

const getClient = () => {
  if (!client) {
    const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env;
    if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
      throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be configured.');
    }
    client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });
  }
  return client;
};

const toRows = ({ columns, rows }) => rows.map((row) =>
  Object.fromEntries(columns.map((column) => [column, row[column]]))
);

const createStatement = (sql, args = []) => ({
  bind: (...boundArgs) => createStatement(sql, boundArgs),
  all: async () => ({ results: toRows(await getClient().execute({ sql, args })) }),
  first: async () => toRows(await getClient().execute({ sql, args }))[0] ?? null,
  run: async () => {
    const result = await getClient().execute({ sql, args });
    return {
      meta: {
        last_row_id: result.lastInsertRowid?.toString(),
        changes: result.rowsAffected
      }
    };
  }
});

export const database = {
  prepare: (sql) => createStatement(sql)
};