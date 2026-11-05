import { err, ok, type Result } from "../../../domain/common/result";
import {
  ENTRY_PHOTO_LIMIT,
  ENTRY_STICKER_LIMIT,
  isLocalDate,
  parseSticker,
  type EntrySticker,
  type IllustrationRecord,
  type JournalEntryRecord,
  type JournalMood,
  type JournalPlace,
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
import { loadDaySpending, type DaySpending } from "./daySpending";
import { dayNumber, suggestEntryDate } from "./journalDates";

/*
 * 日記的寫入與讀取。刪除是軟刪除，可以從提示紙條的「復原」或「最近刪除」放回來。
 */

/** 寫日記與編輯日記時使用者可以改的欄位 */
export interface EntryInput {
  readonly date: string;
  readonly title: string;
  readonly body: string;
  readonly weather: JournalWeather | null;
  readonly mood: JournalMood | null;
  /** 已經存進 App 的照片檔名（saveCoverPhoto），依顯示順序 */
  readonly photos: readonly string[];
  /** 依顯示順序；地名去掉前後空白後不能空白 */
  readonly places: readonly JournalPlace[];
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
    stickers: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  };
  await deps.db.transaction((tx) =>
    createRepositories(tx).journalEntries.insert(entry),
  );
  return ok(entry);
}

/**
 * 修改日記；journalId 和原本的不同時，把這篇日記移到那本手帳（照片、地點跟著走）。
 * 拿掉的照片之後由 tidyCoverPhotos 清掉
 */
export async function updateEntry(
  deps: JournalCommandDeps,
  entryId: string,
  input: EntryInput,
  journalId?: string,
): JournalCommandResult<JournalEntryRecord> {
  const checked = checkEntry(input);
  if (!checked.ok) return checked;
  const repos = createRepositories(deps.db);
  const entry = await repos.journalEntries.findById(entryId);
  if (!entry || entry.deletedAt !== null) {
    return err({ code: "ENTRY_NOT_FOUND", entryId });
  }
  const target = journalId ?? entry.journalId;
  if (target !== entry.journalId && !(await repos.journals.findById(target))) {
    return err({ code: "JOURNAL_NOT_FOUND", journalId: target });
  }
  const updated: JournalEntryRecord = {
    ...entry,
    ...checked.value,
    journalId: target,
    updatedAt: deps.now().toISOString(),
  };
  await deps.db.transaction((tx) =>
    createRepositories(tx).journalEntries.update(updated),
  );
  return ok(updated);
}

/**
 * 換掉一篇日記上貼的插圖（日記頁的「貼插圖」）。位置、大小、角度照 parseSticker
 * 夾回範圍內；貼的插圖都要還在。
 */
export async function saveEntryStickers(
  deps: JournalCommandDeps,
  entryId: string,
  stickers: readonly EntrySticker[],
): JournalCommandResult<JournalEntryRecord> {
  if (stickers.length > ENTRY_STICKER_LIMIT) {
    return err({ code: "TOO_MANY_STICKERS", maxStickers: ENTRY_STICKER_LIMIT });
  }
  const repos = createRepositories(deps.db);
  const entry = await repos.journalEntries.findById(entryId);
  if (!entry || entry.deletedAt !== null) {
    return err({ code: "ENTRY_NOT_FOUND", entryId });
  }
  const tidied: EntrySticker[] = [];
  for (const sticker of stickers) {
    const parsed = parseSticker(sticker);
    if (
      !parsed.ok ||
      !(await repos.illustrations.findById(sticker.illustrationId))
    ) {
      return err({
        code: "ILLUSTRATION_NOT_FOUND",
        illustrationId: sticker.illustrationId,
      });
    }
    tidied.push(parsed.value);
  }
  const updated: JournalEntryRecord = {
    ...entry,
    stickers: tidied,
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

/** 檢查日期、字數、照片張數與地名，回傳去掉前後空白的標題、內容與地名 */
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
  const places: JournalPlace[] = [];
  for (const place of input.places) {
    const name = place.name.trim();
    if (name === "") return err({ code: "EMPTY_PLACE_NAME" });
    const nameLength = checkTextLength("placeName", name);
    if (!nameLength.ok) return nameLength;
    places.push({ name, location: place.location });
  }
  if (
    title === "" &&
    body === "" &&
    input.weather === null &&
    input.mood === null &&
    input.photos.length === 0 &&
    places.length === 0
  ) {
    return err({ code: "EMPTY_ENTRY" });
  }
  return ok({ ...input, title, body, places });
}

/** 日記頁要顯示的資料 */
export interface EntryDetail {
  readonly journal: JournalRecord;
  readonly entry: JournalEntryRecord;
  /** 這本手帳的第幾天（最早一篇的日期是 Day 1） */
  readonly dayNumber: number;
  /** 綁定的帳本這天的消費；沒綁帳本時為 null */
  readonly daySpending: DaySpending | null;
  /** 貼在這篇日記上的插圖，以 id 查 */
  readonly illustrations: Readonly<Record<string, IllustrationRecord>>;
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
  const ids = [...new Set(entry.stickers.map((s) => s.illustrationId))];
  const [entries, daySpending, art] = await Promise.all([
    repos.journalEntries.listByJournal(journal.id),
    journal.ledgerId === null
      ? null
      : loadDaySpending(repos, journal.ledgerId, entry.date),
    Promise.all(ids.map((id) => repos.illustrations.findById(id))),
  ]);
  const illustrations: Record<string, IllustrationRecord> = {};
  for (const illustration of art) {
    if (illustration) illustrations[illustration.id] = illustration;
  }
  return ok({
    journal,
    entry,
    dayNumber: dayNumber(entries[0]?.date ?? entry.date, entry.date),
    daySpending,
    illustrations,
  });
}

/** 一本手帳在表單上需要的資料：換手帳時 Day N 與帳本提示跟著換 */
export interface EntryFormJournal {
  readonly journal: JournalRecord;
  readonly ledger: LedgerRecord | null;
  /** 這本手帳裡其他日記的日期（由舊到新），用來算表單上的 Day N */
  readonly otherDates: readonly string[];
}

/** 寫日記／編輯日記表單需要的資料 */
export interface EntryForm extends EntryFormJournal {
  /** 正在編輯的日記；寫新日記時為 null */
  readonly entry: JournalEntryRecord | null;
  /** 編輯時可以把日記移過去的其他手帳（依建立時間由新到舊）；寫新日記時是空的 */
  readonly moveTargets: readonly EntryFormJournal[];
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
    const others = (await repos.journals.list()).filter(
      (j) => j.id !== journal.id,
    );
    const moveTargets = await Promise.all(
      others.map(async (other) => {
        const [otherEntries, otherLedger] = await Promise.all([
          repos.journalEntries.listByJournal(other.id),
          other.ledgerId ? repos.ledgers.findById(other.ledgerId) : undefined,
        ]);
        return {
          journal: other,
          ledger: otherLedger ?? null,
          otherDates: otherEntries.map((e) => e.date),
        };
      }),
    );
    return ok({
      journal,
      ledger: ledger ?? null,
      entry,
      otherDates,
      moveTargets,
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
    moveTargets: [],
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
