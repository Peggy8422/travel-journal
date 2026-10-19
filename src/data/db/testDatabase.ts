// 僅供測試使用：用 better-sqlite3 在 Node 上跑真正的 SQLite，不應被正式程式碼 import。
import Database from "better-sqlite3";

import { initializeDatabase } from "./initializeDatabase";
import type { SqlDatabase, SqlExecutor, SqlValue } from "./sqlDatabase";

/** 建立已套用所有 migration 的記憶體資料庫 */
export async function createTestDatabase(): Promise<SqlDatabase> {
  const db = openInMemoryDatabase();
  await initializeDatabase(db);
  return db;
}

/** 建立空的記憶體資料庫（未套用 migration），用來測試 migration 本身 */
export function openInMemoryDatabase(): SqlDatabase {
  const raw = new Database(":memory:");
  const executor = wrap(raw);
  return {
    ...executor,
    async transaction(task) {
      raw.exec("BEGIN IMMEDIATE");
      try {
        const result = await task(executor);
        raw.exec("COMMIT");
        return result;
      } catch (error) {
        raw.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

function wrap(raw: Database.Database): SqlExecutor {
  const bind = (params: readonly SqlValue[] = []) => [...params];
  return {
    execAsync: async (sql) => {
      raw.exec(sql);
    },
    runAsync: async (sql, params) => ({
      changes: raw.prepare(sql).run(bind(params)).changes,
    }),
    getFirstAsync: async <T>(sql: string, params?: readonly SqlValue[]) =>
      raw.prepare(sql).get(bind(params)) as T | undefined,
    getAllAsync: async <T>(sql: string, params?: readonly SqlValue[]) =>
      raw.prepare(sql).all(bind(params)) as T[],
  };
}
