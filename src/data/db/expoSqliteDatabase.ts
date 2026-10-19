import type { SQLiteDatabase } from "expo-sqlite";

import type { SqlDatabase, SqlExecutor, SqlValue } from "./sqlDatabase";

/**
 * 把 expo-sqlite 的資料庫包成 SqlDatabase。
 * transaction 使用 withExclusiveTransactionAsync，避免 transaction 期間其他非同步查詢混進來；
 * 這個 API 不支援 web。
 */
export function fromExpoSqlite(db: SQLiteDatabase): SqlDatabase {
  return {
    ...wrapExecutor(db),
    async transaction(task) {
      let result: Awaited<ReturnType<typeof task>> | undefined;
      await db.withExclusiveTransactionAsync(async (txn) => {
        result = await task(wrapExecutor(txn));
      });
      return result as Awaited<ReturnType<typeof task>>;
    },
  };
}

function wrapExecutor(db: SQLiteDatabase): SqlExecutor {
  const bind = (params: readonly SqlValue[] = []) => [...params];
  return {
    execAsync: (sql) => db.execAsync(sql),
    runAsync: (sql, params) => db.runAsync(sql, bind(params)),
    getFirstAsync: async <T>(sql: string, params?: readonly SqlValue[]) =>
      (await db.getFirstAsync<T>(sql, bind(params))) ?? undefined,
    getAllAsync: <T>(sql: string, params?: readonly SqlValue[]) =>
      db.getAllAsync<T>(sql, bind(params)),
  };
}
