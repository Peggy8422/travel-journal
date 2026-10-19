import { MIGRATIONS, type Migration } from "./migrations";
import type { SqlDatabase } from "./sqlDatabase";

/**
 * 每次開啟資料庫時呼叫（SQLiteProvider 的 onInit）：設定連線，再執行尚未套用的 migration。
 * 已套用的版本記在 PRAGMA user_version。
 */
export async function initializeDatabase(
  db: SqlDatabase,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<void> {
  // foreign_keys 不會存進資料庫檔案，每個連線都要設定；在 transaction 內設定無效
  await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

  assertContiguous(migrations);
  const latest = migrations.length;
  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  const current = row?.user_version ?? 0;
  if (current > latest) {
    throw new Error(
      `Database schema version ${current} is newer than this app supports (${latest})`,
    );
  }

  for (const migration of migrations.slice(current)) {
    await db.transaction(async (tx) => {
      await tx.execAsync(migration.sql);
      await tx.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }
}

function assertContiguous(migrations: readonly Migration[]): void {
  migrations.forEach((m, i) => {
    if (m.version !== i + 1) {
      throw new Error(
        `Migration versions must start at 1 and be contiguous, got ${m.version} at index ${i}`,
      );
    }
  });
}
