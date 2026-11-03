import type { SqlDatabase, SqlExecutor } from "../../../data/db/sqlDatabase";
import { createRepositories } from "../../../data/repositories";
import type { JournalBackup, JournalRecord } from "../../../domain/journal";

/** 讀出所有手帳的完整資料（含已刪除的日記），依建立時間由新到舊 */
export async function collectJournalBackups(
  db: SqlExecutor,
): Promise<JournalBackup[]> {
  const repos = createRepositories(db);
  const journals = await repos.journals.list();
  return Promise.all(
    journals.map(async (journal) => ({
      journal,
      entries: await repos.journalEntries.listByJournal(journal.id, {
        includeDeleted: true,
      }),
    })),
  );
}

export interface JournalRestoreReport {
  readonly restored: readonly JournalRecord[];
  /** 手機上已經有同一本手帳，沒有動它 */
  readonly skipped: readonly JournalRecord[];
  readonly failed: readonly {
    readonly journal: JournalRecord;
    readonly reason: string;
  }[];
}

/**
 * 還原手帳，規則和帳本一樣：已經存在的（同一個 id）略過，每本各自一個 transaction。
 * 要在帳本還原之後呼叫：綁定的帳本手機上沒有，或已經綁給別本手帳時，改成不綁定，
 * 手帳和日記照樣還原。
 */
export async function restoreJournalBackups(
  db: SqlDatabase,
  backups: readonly JournalBackup[],
): Promise<JournalRestoreReport> {
  const restored: JournalRecord[] = [];
  const skipped: JournalRecord[] = [];
  const failed: { journal: JournalRecord; reason: string }[] = [];

  for (const backup of backups) {
    if (await createRepositories(db).journals.findById(backup.journal.id)) {
      skipped.push(backup.journal);
      continue;
    }
    try {
      const journal = await db.transaction(async (tx) => {
        const repos = createRepositories(tx);
        const journal = {
          ...backup.journal,
          ledgerId: await bindableLedger(tx, backup.journal.ledgerId),
        };
        await repos.journals.insert(journal);
        for (const entry of backup.entries) {
          await repos.journalEntries.insert({
            ...entry,
            journalId: journal.id,
          });
        }
        return journal;
      });
      restored.push(journal);
    } catch (error) {
      failed.push({
        journal: backup.journal,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { restored, skipped, failed };
}

async function bindableLedger(
  tx: SqlExecutor,
  ledgerId: string | null,
): Promise<string | null> {
  if (ledgerId === null) return null;
  const repos = createRepositories(tx);
  const ledger = await repos.ledgers.findById(ledgerId);
  if (!ledger || ledger.kind !== "shared") return null;
  return (await repos.journals.findByLedger(ledgerId)) ? null : ledgerId;
}
