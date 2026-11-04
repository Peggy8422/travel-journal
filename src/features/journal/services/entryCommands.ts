import { err, ok, type Result } from "../../../domain/common/result";
import {
  ENTRY_PHOTO_LIMIT,
  isLocalDate,
  type JournalEntryRecord,
  type JournalMood,
  type JournalRecord,
  type JournalWeather,
} from "../../../domain/journal";
import { checkTextLength, type LedgerRecord } from "../../../domain/ledger";
import type { SqlExecutor } from "../../../data/db/sqlDatabase";
import { createRepositories } from "../../../data/repositories";
import type {
  JournalCommandDeps,
  JournalCommandError,
  JournalCommandResult,
} from "./journalCommands";
import { dayNumber, suggestEntryDate } from "./journalDates";

/*
 * 日記的寫入與讀取。刪除是軟刪除，可以從提示紙條的「復原」或「最近刪除」放回來。
 */

/** 寫日記與編輯日記時使用者可以改的欄位；地點之後再加 */
export interface EntryInput {
  readonly date: string;
  readonly title: string;
  readonly body: string;
  readonly weather: JournalWeather | null;
  readonly mood: JournalMood | null;
  /** 已經存進 App 的照片檔名（saveCoverPhoto），依顯示順序 */
  readonly photos: readonly string[];
}

export async function writeEntry(
  deps: JournalCommandDeps,
  journalId: string,
  input: EntryInput,
): JournalCommandResult<JournalEntryRecord> {
  const checked = checkEntry(input);
  if (!checked.ok) return checked;
  const repos = createRepositories(deps.db);
  if (!(await repos.journals.findById(journalId))) {
    return err({ code: "JOURNAL_NOT_FOUND", journalId });
  }
  const timestamp = deps.now().toISOString();
  const entry: JournalEntryRecord = {
    ...checked.value,
    id: deps.newId(),
    journalId,
    places: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  };
  await deps.db.transaction((tx) =>
    createRepositories(tx).journalEntries.insert(entry),
  );
  return ok(entry);
}

/** 地點保留原本的；拿掉的照片之後由 tidyCoverPhotos 清掉 */
export async function updateEntry(
  deps: JournalCommandDeps,
  entryId: string,
  input: EntryInput,
): JournalCommandResult<JournalEntryRecord> {
  const checked = checkEntry(input);
  if (!checked.ok) return checked;
  const entry = await createRepositories(deps.db).journalEntries.findById(
    entryId,
  );
  if (!entry || entry.deletedAt !== null) {
    return err({ code: "ENTRY_NOT_FOUND", entryId });
  }
  const updated: JournalEntryRecord = {
    ...entry,
    ...checked.value,
    updatedAt: deps.now().toISOString(),
  };
  await deps.db.transaction((tx) =>
    createRepositories(tx).journalEntries.update(updated),
  );
  return ok(updated);
}

export async function deleteEntry(
  deps: JournalCommandDeps,
  entryId: string,
): JournalCommandResult<void> {
  const repos = createRepositories(deps.db);
  const entry = await repos.journalEntries.findById(entryId);
  if (!entry || entry.deletedAt !== null) {
    return err({ code: "ENTRY_NOT_FOUND", entryId });
  }
  await repos.journalEntries.softDelete(entryId, deps.now().toISOString());
  return ok(undefined);
}

/** 放回刪除的日記；已經在手帳裡的也算成功 */
export async function restoreEntry(
  deps: JournalCommandDeps,
  entryId: string,
): JournalCommandResult<void> {
  const repos = createRepositories(deps.db);
  const entry = await repos.journalEntries.findById(entryId);
  if (!entry) return err({ code: "ENTRY_NOT_FOUND", entryId });
  if (entry.deletedAt !== null) {
    await repos.journalEntries.restore(entryId, deps.now().toISOString());
  }
  return ok(undefined);
}

/** 檢查日期、字數與照片張數，回傳去掉前後空白的標題與內容 */
function checkEntry(
  input: EntryInput,
): Result<EntryInput, JournalCommandError> {
  if (!isLocalDate(input.date)) {
    return err({ code: "INVALID_ENTRY_DATE", date: input.date });
  }
  const title = input.title.trim();
  const body = input.body.trim();
  const titleLength = checkTextLength("entryTitle", title);
  if (!titleLength.ok) return titleLength;
  const bodyLength = checkTextLength("entryBody", body);
  if (!bodyLength.ok) return bodyLength;
  if (input.photos.length > ENTRY_PHOTO_LIMIT) {
    return err({ code: "TOO_MANY_PHOTOS", max: ENTRY_PHOTO_LIMIT });
  }
  if (
    title === "" &&
    body === "" &&
    input.weather === null &&
    input.mood === null &&
    input.photos.length === 0
  ) {
    return err({ code: "EMPTY_ENTRY" });
  }
  return ok({ ...input, title, body });
}

/** 日記頁要顯示的資料 */
export interface EntryDetail {
  readonly journal: JournalRecord;
  readonly entry: JournalEntryRecord;
  /** 這本手帳的第幾天（最早一篇的日期是 Day 1） */
  readonly dayNumber: number;
}

/** 刪除的日記讀不到（日記頁直接當作不存在） */
export async function loadEntry(
  db: SqlExecutor,
  entryId: string,
): JournalCommandResult<EntryDetail> {
  const repos = createRepositories(db);
  const entry = await repos.journalEntries.findById(entryId);
  if (!entry || entry.deletedAt !== null) {
    return err({ code: "ENTRY_NOT_FOUND", entryId });
  }
  const journal = await repos.journals.findById(entry.journalId);
  if (!journal) {
    return err({ code: "JOURNAL_NOT_FOUND", journalId: entry.journalId });
  }
  const entries = await repos.journalEntries.listByJournal(journal.id);
  return ok({
    journal,
    entry,
    dayNumber: dayNumber(entries[0]?.date ?? entry.date, entry.date),
  });
}

/** 寫日記／編輯日記表單需要的資料 */
export interface EntryForm {
  readonly journal: JournalRecord;
  readonly ledger: LedgerRecord | null;
  /** 正在編輯的日記；寫新日記時為 null */
  readonly entry: JournalEntryRecord | null;
  /** 其他日記的日期（由舊到新），用來算表單上的 Day N */
  readonly otherDates: readonly string[];
  /** 寫新日記時預設的日期；編輯時是原本的日期 */
  readonly date: string;
}

/**
 * 讀出表單的資料。entryId 為 null 時是寫新日記，today 是手機上的今天（YYYY-MM-DD），
 * 用來決定預設日期。
 */
export async function loadEntryForm(
  db: SqlExecutor,
  journalId: string,
  entryId: string | null,
  today: string,
): JournalCommandResult<EntryForm> {
  const repos = createRepositories(db);
  const journal = await repos.journals.findById(journalId);
  if (!journal) return err({ code: "JOURNAL_NOT_FOUND", journalId });
  const [entries, ledger] = await Promise.all([
    repos.journalEntries.listByJournal(journalId),
    journal.ledgerId ? repos.ledgers.findById(journal.ledgerId) : undefined,
  ]);
  const others = entries.filter((e) => e.id !== entryId);
  const otherDates = others.map((e) => e.date);
  if (entryId !== null) {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return err({ code: "ENTRY_NOT_FOUND", entryId });
    return ok({
      journal,
      ledger: ledger ?? null,
      entry,
      otherDates,
      date: entry.date,
    });
  }
  // 消費的時間帶著當地時區，前 10 個字就是當地日期
  const firstExpense = ledger
    ? (await repos.expenses.listByLedger(ledger.id))[0]
    : undefined;
  return ok({
    journal,
    ledger: ledger ?? null,
    entry: null,
    otherDates,
    date: suggestEntryDate({
      lastDate: otherDates[otherDates.length - 1] ?? null,
      firstExpenseDate: firstExpense?.occurredAt.slice(0, 10) ?? null,
      today,
    }),
  });
}

/** 一本手帳裡刪除的日記，最近刪除的在前 */
export async function loadDeletedEntries(
  db: SqlExecutor,
  journalId: string,
): Promise<JournalEntryRecord[]> {
  const entries = await createRepositories(db).journalEntries.listByJournal(
    journalId,
    { includeDeleted: true },
  );
  return entries
    .filter((e) => e.deletedAt !== null)
    .sort((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""));
}
