import { getCloudflareContext } from "@opennextjs/cloudflare";

async function getDb(): Promise<any> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    if (env && (env as any).DB) {
      return (env as any).DB;
    }
  } catch (e) {
    // getCloudflareContext might throw when running outside Cloudflare Worker environment
  }

  if (typeof process !== "undefined" && process.env && (process.env as any).DB) {
    return (process.env as any).DB;
  }

  throw new Error("D1 database binding 'DB' was not found in Cloudflare context or process.env.");
}

export async function query(sql: string, params: any[] = []) {
  const db = await getDb();

  // Convert PostgreSQL positional placeholders ($1, $2, ...) to SQLite placeholders (?)
  let paramIndex = 1;
  let sqliteSql = sql.replace(/\$(\d+)/g, () => "?");

  // Convert PostgreSQL specific syntax if necessary
  // e.g. "ANY(?)" in "id = ANY($1)" or "id = ANY(?)" -> SQLite IN (...)
  if (sqliteSql.includes("ANY(?)")) {
    const arrayParamIndex = params.findIndex(p => Array.isArray(p));
    if (arrayParamIndex !== -1 && Array.isArray(params[arrayParamIndex])) {
      const arr = params[arrayParamIndex];
      if (arr.length === 0) {
        sqliteSql = sqliteSql.replace("= ANY(?)", "IN (NULL)");
        params.splice(arrayParamIndex, 1);
      } else {
        const placeholders = arr.map(() => "?").join(", ");
        sqliteSql = sqliteSql.replace("= ANY(?)", `IN (${placeholders})`);
        params.splice(arrayParamIndex, 1, ...arr);
      }
    }
  }

  // SQLite doesn't support "ADD COLUMN IF NOT EXISTS" syntax, convert to "ADD COLUMN"
  sqliteSql = sqliteSql.replace(/ADD COLUMN IF NOT EXISTS/gi, "ADD COLUMN");

  try {
    const stmt = db.prepare(sqliteSql);
    const bound = params.length > 0 ? stmt.bind(...params) : stmt;

    // Check if query is a SELECT/RETURNING statement or mutation
    const isSelect = /^\s*(SELECT|PRAGMA|EXPLAIN)/i.test(sqliteSql);

    if (isSelect) {
      const result = await bound.all();
      return {
        rows: result.results || [],
        rowCount: result.results ? result.results.length : 0,
      };
    } else {
      const result = await bound.run();
      return {
        rows: [],
        rowCount: result.meta ? result.meta.changes : 0,
      };
    }
  } catch (error: any) {
    console.error("D1 Query Error:", { sql: sqliteSql, params, error: error.message });
    throw error;
  }
}

export default { query };
