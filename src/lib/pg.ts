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

  return null;
}

export async function query(sql: string, params: any[] = []) {
  const db = await getDb();
  if (!db) {
    console.warn("D1 database binding 'DB' not available. Returning empty result.");
    return { rows: [], rowCount: 0 };
  }

  // Clone params array so we don't mutate caller's original array
  const boundParams = [...params];

  // Convert PostgreSQL positional placeholders ($1, $2, ...) to SQLite placeholders (?)
  let sqliteSql = sql.replace(/\$(\d+)/g, () => "?");

  // Convert PostgreSQL specific syntax if necessary
  // e.g. "ANY(?)" in "id = ANY($1)" or "id = ANY(?)" -> SQLite IN (...)
  if (sqliteSql.includes("ANY(?)")) {
    const arrayParamIndex = boundParams.findIndex(p => Array.isArray(p));
    if (arrayParamIndex !== -1 && Array.isArray(boundParams[arrayParamIndex])) {
      const arr = boundParams[arrayParamIndex];
      if (arr.length === 0) {
        sqliteSql = sqliteSql.replace("= ANY(?)", "IN (NULL)");
        boundParams.splice(arrayParamIndex, 1);
      } else {
        const placeholders = arr.map(() => "?").join(", ");
        sqliteSql = sqliteSql.replace("= ANY(?)", `IN (${placeholders})`);
        boundParams.splice(arrayParamIndex, 1, ...arr);
      }
    }
  }

  // SQLite doesn't support "ADD COLUMN IF NOT EXISTS" syntax, convert to "ADD COLUMN"
  sqliteSql = sqliteSql.replace(/ADD COLUMN IF NOT EXISTS/gi, "ADD COLUMN");

  try {
    const stmt = db.prepare(sqliteSql);
    const bound = boundParams.length > 0 ? stmt.bind(...boundParams) : stmt;

    // Check if query is a SELECT/PRAGMA statement
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
    console.error("D1 Query Error:", { sql: sqliteSql, params: boundParams, error: error.message });
    return { rows: [], rowCount: 0 };
  }
}

export default { query };
