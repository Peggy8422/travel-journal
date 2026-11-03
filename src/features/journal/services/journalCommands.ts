import { err, ok, type Result } from "../../../domain/common/result";
import type {
  JournalCover,
  JournalEntryRecord,
  JournalRecord,
} from "../../../domain/journal";
import {
  checkTextLength,
  type LedgerRecord,
  type TextTooLongError,
} from "../../../domain/ledger";
import type { SqlExecutor } from "../../../data/db/sqlDatabase";
import { createRepositories } from "../../../data/repositories";
import type { LedgerCommandDeps } from "../../ledger/services/ledgerCommands";
import { tripMonthOf } from "../../ledger/services/ledgerOverview";

/*
 * 手帳的寫入與讀取流程。和帳本一樣：驗證失敗回傳 Result，資料庫錯誤直接 throw。
 */

export type JournalCommandDeps = LedgerCommandDeps;

export type JournalCommandError =
  | TextTooLongError
  | { readonly code: "EMPTY_NAME" }
  | { readonly code: "JOURNAL_NOT_FOUND"; readonly journalId: string }
  | { readonly code: "LEDGER_NOT_FOUND"; readonly ledgerId: string }
  /** 這本帳本已經綁了另一本手帳 */
  | {
      readonly code: "LEDGER_HAS_JOURNAL";
      readonly ledgerId: string;
      readonly journalName: string;
    };

export type JournalCommandResult<T> = Promise<Result<T, JournalCommandError>>;

/** 建立與修改手帳時使用者可以改的欄位 */
export interface JournalInput {
  readonly name: string;
  readonly ledgerId: string | null;
  readonly cover: JournalCover;
}

export async function createJournal(
  deps: JournalCommandDeps,
  input: JournalInput,
): JournalCommandResult<JournalRecord> {
  const checked = await checkInput(deps.db, input, null);
  if (!checked.ok) return checked;
  const timestamp = deps.now().toISOString();
  const journal: JournalRecord = {
    id: deps.newId(),
    name: checked.value,
    ledgerId: input.ledgerId,
    cover: input.cover,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await createRepositories(deps.db).journals.insert(journal);
  return ok(journal);
}

/** 手帳設定的「儲存變更」：名稱、綁定的帳本、封面一起改 */
export async function updateJournal(
  deps: JournalCommandDeps,
  journalId: string,
  input: JournalInput,
): JournalCommandResult<JournalRecord> {
  const repos = createRepositories(deps.db);
  const journal = await repos.journals.findById(journalId);
  if (!journal) return err({ code: "JOURNAL_NOT_FOUND", journalId });
  const checked = await checkInput(deps.db, input, journalId);
  if (!checked.ok) return checked;
  const updated: JournalRecord = {
    ...journal,
    name: checked.value,
    ledgerId: input.ledgerId,
    cover: input.cover,
    updatedAt: deps.now().toISOString(),
  };
  await repos.journals.update(updated);
  return ok(updated);
}

/** 永久刪除手帳與裡面所有的日記；用不到的照片之後由 tidyCoverPhotos 清掉 */
export async function deleteJournal(
  deps: JournalCommandDeps,
  journalId: string,
): JournalCommandResult<void> {
  const repos = createRepositories(deps.db);
  if (!(await repos.journals.findById(journalId))) {
    return err({ code: "JOURNAL_NOT_FOUND", journalId });
  }
  await repos.journals.delete(journalId);
  return ok(undefined);
}

/** 檢查名稱與要綁的帳本，回傳去掉前後空白的名稱。selfId 是正在修改的手帳 */
async function checkInput(
  db: SqlExecutor,
  input: JournalInput,
  selfId: string | null,
): Promise<Result<string, JournalCommandError>> {
  const name = input.name.trim();
  if (name === "") return err({ code: "EMPTY_NAME" });
  const length = checkTextLength("journalName", name);
  if (!length.ok) return length;
  if (input.ledgerId !== null) {
    const repos = createRepositories(db);
    const ledger = await repos.ledgers.findById(input.ledgerId);
    // 個人帳本不能綁：日記頁要列的是旅行的分帳消費
    if (!ledger || ledger.kind !== "shared") {
      return err({ code: "LEDGER_NOT_FOUND", ledgerId: input.ledgerId });
    }
    const bound = await repos.journals.findByLedger(input.ledgerId);
    if (bound && bound.id !== selfId) {
      return err({
        code: "LEDGER_HAS_JOURNAL",
        ledgerId: input.ledgerId,
        journalName: bound.name,
      });
    }
  }
  return ok(name);
}

/** 書架上一本手帳要顯示的資料 */
export interface JournalOverview {
  readonly journal: JournalRecord;
  /** 綁定的帳本；沒有綁定時為 null */
  readonly ledger: LedgerRecord | null;
  readonly entryCount: number;
  /** 最早與最晚一篇日記的日期，沒有日記時為 null */
  readonly firstDate: string | null;
  readonly lastDate: string | null;
  /** 日期最晚的一篇（同一天取最後寫的），給個人分頁的「最近一篇」 */
  readonly latestEntry: JournalEntryRecord | null;
}

async function overviewOf(
  db: SqlExecutor,
  journal: JournalRecord,
): Promise<JournalOverview> {
  const repos = createRepositories(db);
  const [entries, ledger] = await Promise.all([
    repos.journalEntries.listByJournal(journal.id),
    journal.ledgerId ? repos.ledgers.findById(journal.ledgerId) : undefined,
  ]);
  const first = entries[0];
  const last = entries[entries.length - 1];
  return {
    journal,
    ledger: ledger ?? null,
    entryCount: entries.length,
    firstDate: first?.date ?? null,
    lastDate: last?.date ?? null,
    latestEntry: last ?? null,
  };
}

/** 所有手帳，依建立時間由新到舊 */
export async function loadJournalShelf(
  db: SqlExecutor,
): Promise<JournalOverview[]> {
  const journals = await createRepositories(db).journals.list();
  return Promise.all(journals.map((journal) => overviewOf(db, journal)));
}

export interface JournalDetail extends JournalOverview {
  /** 依日期由舊到新 */
  readonly entries: readonly JournalEntryRecord[];
}

export async function loadJournal(
  db: SqlExecutor,
  journalId: string,
): JournalCommandResult<JournalDetail> {
  const repos = createRepositories(db);
  const journal = await repos.journals.findById(journalId);
  if (!journal) return err({ code: "JOURNAL_NOT_FOUND", journalId });
  const [overview, entries] = await Promise.all([
    overviewOf(db, journal),
    repos.journalEntries.listByJournal(journalId),
  ]);
  return ok({ ...overview, entries });
}

/** 綁定帳本的選項：分帳帳本由新到舊，已經綁給別本手帳的附上那本手帳的名稱 */
export interface LedgerChoice {
  readonly ledger: LedgerRecord;
  /** 旅行月份 YYYY-MM，和書架上的分組一樣 */
  readonly tripMonth: string;
  /** 已經綁定這本帳本的其他手帳名稱；可以選時為 null */
  readonly takenBy: string | null;
}

export async function loadLedgerChoices(
  db: SqlExecutor,
  selfJournalId: string | null,
): Promise<LedgerChoice[]> {
  const repos = createRepositories(db);
  const [ledgers, journals] = await Promise.all([
    repos.ledgers.list({ kind: "shared" }),
    repos.journals.list(),
  ]);
  const owner = new Map(
    journals
      .filter((j) => j.ledgerId !== null && j.id !== selfJournalId)
      .map((j) => [j.ledgerId, j.name]),
  );
  return Promise.all(
    ledgers.map(async (ledger) => ({
      ledger,
      tripMonth: tripMonthOf(
        ledger,
        await repos.expenses.listByLedger(ledger.id),
      ),
      takenBy: owner.get(ledger.id) ?? null,
    })),
  );
}
