/*
 * repository 依賴的最小資料庫介面。
 * App 用 expo-sqlite 實作（expoSqliteDatabase.ts），測試用 better-sqlite3 實作，
 * 讓 SQL 本身（外鍵、CHECK、JSON 函式）能在 Jest 裡用真正的 SQLite 驗證。
 * 參數一律用位置參數（?），兩邊的具名參數語法不同。
 */

export type SqlValue = string | number | null;

export interface SqlExecutor {
  /** 執行一段或多段不需要參數的 SQL（建表、PRAGMA） */
  execAsync(sql: string): Promise<void>;
  runAsync(
    sql: string,
    params?: readonly SqlValue[],
  ): Promise<{ readonly changes: number }>;
  getFirstAsync<T>(
    sql: string,
    params?: readonly SqlValue[],
  ): Promise<T | undefined>;
  getAllAsync<T>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
}

export interface SqlDatabase extends SqlExecutor {
  /**
   * 在 transaction 中執行 task，task 拋錯時 rollback。
   * task 內的查詢都必須透過傳入的 tx 執行。
   */
  transaction<T>(task: (tx: SqlExecutor) => Promise<T>): Promise<T>;
}
