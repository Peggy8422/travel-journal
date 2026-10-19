import { randomUUID } from "expo-crypto";
import {
  SQLiteProvider,
  useSQLiteContext,
  type SQLiteDatabase,
} from "expo-sqlite";
import { useMemo, type ReactNode } from "react";

import { fromExpoSqlite } from "../../data/db/expoSqliteDatabase";
import { initializeDatabase } from "../../data/db/initializeDatabase";
import type { SqlDatabase } from "../../data/db/sqlDatabase";
import type { LedgerCommandDeps } from "../ledger/services/ledgerCommands";

const DATABASE_NAME = "travel-journal.db";

async function onInit(db: SQLiteDatabase): Promise<void> {
  await initializeDatabase(fromExpoSqlite(db));
}

/** 開啟資料庫並套用 migration，完成後才渲染 children */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={onInit}>
      {children}
    </SQLiteProvider>
  );
}

export function useDatabase(): SqlDatabase {
  const db = useSQLiteContext();
  return useMemo(() => fromExpoSqlite(db), [db]);
}

/** 帳本寫入流程需要的相依：資料庫、id 產生器、目前時間 */
export function useLedgerCommandDeps(): LedgerCommandDeps {
  const db = useDatabase();
  return useMemo(
    () => ({ db, newId: randomUUID, now: () => new Date() }),
    [db],
  );
}
