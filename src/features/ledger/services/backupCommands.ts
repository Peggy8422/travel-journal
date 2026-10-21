import {
  parseBackup,
  serializeBackup,
  type BackupFileError,
} from "../../../data/backup/backupFile";
import type { SqlDatabase, SqlExecutor } from "../../../data/db/sqlDatabase";
import { createRepositories } from "../../../data/repositories";
import { ok, type Result } from "../../../domain/common/result";
import { toTaipeiDate } from "../../../domain/fx";
import type { LedgerBackup, LedgerRecord } from "../../../domain/ledger";

/** 讀出所有帳本的完整資料（含已刪除的消費與還款），依建立時間由新到舊 */
export async function collectBackup(db: SqlExecutor): Promise<LedgerBackup[]> {
  const repos = createRepositories(db);
  const ledgers = await repos.ledgers.list();
  const backups: LedgerBackup[] = [];
  for (const ledger of ledgers) {
    const [members, expenses, settlements] = await Promise.all([
      repos.members.listByLedger(ledger.id),
      repos.expenses.listByLedger(ledger.id, { includeDeleted: true }),
      repos.settlements.listByLedger(ledger.id, { includeDeleted: true }),
    ]);
    backups.push({ ledger, members, expenses, settlements });
  }
  return backups;
}

export interface RestoreReport {
  readonly restored: readonly LedgerRecord[];
  /** 手機上已經有同一本帳本，沒有動它 */
  readonly skipped: readonly LedgerRecord[];
  /** 資料不一致（例如付款人不在成員裡）而無法還原，這本帳本沒有寫入任何資料 */
  readonly failed: readonly {
    readonly ledger: LedgerRecord;
    readonly reason: string;
  }[];
}

/**
 * 從備份還原帳本。已經存在的帳本（同一個 id）一律略過，不覆蓋任何現有資料。
 * 每本帳本各自一個 transaction：一本失敗不影響其他本，失敗的那本也不會留下一半的資料。
 * 保留原本的 id 與時間戳記，所以同一份備份還原兩次，第二次會全部略過。
 */
export async function restoreBackup(
  db: SqlDatabase,
  backups: readonly LedgerBackup[],
): Promise<RestoreReport> {
  const restored: LedgerRecord[] = [];
  const skipped: LedgerRecord[] = [];
  const failed: { ledger: LedgerRecord; reason: string }[] = [];

  for (const backup of backups) {
    if (await createRepositories(db).ledgers.findById(backup.ledger.id)) {
      skipped.push(backup.ledger);
      continue;
    }
    try {
      await db.transaction((tx) => insertLedgerBackup(tx, backup));
      restored.push(backup.ledger);
    } catch (error) {
      failed.push({
        ledger: backup.ledger,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { restored, skipped, failed };
}

async function insertLedgerBackup(
  tx: SqlExecutor,
  { ledger, members, expenses, settlements }: LedgerBackup,
): Promise<void> {
  const repos = createRepositories(tx);
  await repos.ledgers.insert(ledger);

  // repository 依寫入順序指派 sortOrder，照原本的順序寫入才能保留加入順序
  const ordered = [...members].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const member of ordered) {
    await repos.members.insert({
      id: member.id,
      ledgerId: ledger.id,
      name: member.name,
      createdAt: member.createdAt,
    });
    if (member.archivedAt !== null) {
      await repos.members.setArchived(member.id, member.archivedAt);
    }
  }
  for (const expense of expenses) {
    await repos.expenses.insert({ ...expense, ledgerId: ledger.id });
  }
  for (const settlement of settlements) {
    await repos.settlements.insert({ ...settlement, ledgerId: ledger.id });
  }
}

/** 產生完整備份檔的檔名與內容 */
export async function buildBackupFile(
  db: SqlExecutor,
  now: Date,
): Promise<{ fileName: string; content: string }> {
  const ledgers = await collectBackup(db);
  const date = toTaipeiDate(now.toISOString());
  return {
    fileName: `旅遊記帳備份-${date.ok ? date.value : "backup"}.json`,
    content: serializeBackup({ exportedAt: now.toISOString(), ledgers }),
  };
}

/** 解析備份檔內容後還原；檔案格式不對時回傳錯誤，不寫入任何資料 */
export async function restoreFromBackupText(
  db: SqlDatabase,
  text: string,
): Promise<Result<RestoreReport, BackupFileError>> {
  const parsed = parseBackup(text);
  if (!parsed.ok) return parsed;
  return ok(await restoreBackup(db, parsed.value.ledgers));
}
