import { err, ok, type Result } from "../../domain/common/result";
import {
  ENTRY_STICKER_LIMIT,
  isJournalMood,
  isJournalWeather,
  isLocalDate,
  parseJournalCover,
  parseSticker,
  parseStrokes,
  type EntrySticker,
  type IllustrationRecord,
  type JournalBackup,
  type JournalEntryRecord,
  type JournalPlace,
  type JournalRecord,
} from "../../domain/journal";
import {
  isCoverPhotoName,
  isTripMonth,
  parseCover,
  type ExpenseFx,
  type ExpenseRecord,
  type GeoPoint,
  type LedgerBackup,
  type LedgerRecord,
  type MemberRecord,
  type SettlementRecord,
} from "../../domain/ledger";
import { decodeSplitRule } from "../db/splitRuleJson";

/*
 * 備份檔（JSON）的格式。讀回時一律視為不可信任的輸入：
 * 使用者可能選錯檔案，或檔案被其他程式改過，所以每個欄位都檢查型別，
 * 不符合就整份拒絕，不猜測也不部分匯入。
 * 業務規則（例如付款人是否屬於帳本）由資料庫約束與還原流程檢查。
 */

export const BACKUP_FORMAT = "travel-journal-backup";
/**
 * 目前寫出的版本。
 * 2：帳本加上 kind（分帳／個人）、成員加上 isSelf。讀取 1 版時這兩個欄位用預設值。
 * 3：帳本加上 cover（封面的三個代碼，或 null）。讀取 1、2 版時當作沒有封面。
 * 4：帳本加上 tripMonth。
 * 5：照片封面：cover 多一個 photo（檔名），照片本身放在最外層的 photos（檔名 → base64 JPEG）。
 *    讀取 1～4 版時沒有照片。
 * 6：旅遊手帳：最外層多一個 journals（手帳與日記），手帳封面與日記的照片也放在 photos。
 *    讀取 1～5 版時沒有手帳。
 * 7：手繪插圖：最外層多一個 illustrations（筆畫），日記多一個 stickers（貼在頁上的插圖）。
 *    讀取 1～6 版時沒有插圖，日記沒有貼紙。
 */
export const BACKUP_VERSION = 7;
/** 可以讀取的版本 */
const READABLE_VERSIONS: readonly unknown[] = [1, 2, 3, 4, 5, 6, 7];

export interface BackupContents {
  /** 匯出時間，ISO 8601 UTC */
  readonly exportedAt: string;
  readonly ledgers: readonly LedgerBackup[];
  readonly journals: readonly JournalBackup[];
  readonly illustrations: readonly IllustrationRecord[];
  /** 照片的檔案（帳本與手帳的封面、日記的照片）：檔名 → base64 的 JPEG */
  readonly photos: Readonly<Record<string, string>>;
}

export type BackupFileError =
  | { readonly code: "INVALID_BACKUP"; readonly reason: string }
  | { readonly code: "UNSUPPORTED_BACKUP_VERSION"; readonly version: unknown };

export function serializeBackup(contents: BackupContents): string {
  return JSON.stringify(
    {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: contents.exportedAt,
      ledgers: contents.ledgers,
      journals: contents.journals,
      illustrations: contents.illustrations,
      photos: contents.photos,
    },
    null,
    2,
  );
}

export function parseBackup(
  text: string,
): Result<BackupContents, BackupFileError> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return invalid("not valid JSON");
  }
  if (!isObject(value) || value.format !== BACKUP_FORMAT) {
    return invalid("not a travel journal backup");
  }
  if (!READABLE_VERSIONS.includes(value.version)) {
    return err({ code: "UNSUPPORTED_BACKUP_VERSION", version: value.version });
  }
  if (typeof value.exportedAt !== "string")
    return invalid("missing exportedAt");
  if (!Array.isArray(value.ledgers)) return invalid("ledgers must be an array");

  const ledgers: LedgerBackup[] = [];
  for (const [index, entry] of value.ledgers.entries()) {
    const parsed = parseLedgerBackup(entry);
    if (!parsed.ok) {
      return invalid(`ledgers[${index}]: ${parsed.error}`);
    }
    ledgers.push(parsed.value);
  }
  // 1～5 版沒有手帳
  const journals = parseList(
    value.journals ?? [],
    "journals",
    parseJournalBackup,
  );
  if (!journals.ok) return invalid(journals.error);
  // 1～6 版沒有插圖
  const illustrations = parseList(
    value.illustrations ?? [],
    "illustrations",
    parseIllustration,
  );
  if (!illustrations.ok) return invalid(illustrations.error);
  const photos = parsePhotos(value.photos);
  if (!photos.ok) return invalid(photos.error);
  return ok({
    exportedAt: value.exportedAt,
    ledgers,
    journals: journals.value,
    illustrations: illustrations.value,
    photos: photos.value,
  });
}

/** 1～4 版沒有 photos。檔名格式不對的照片不收：照片只影響外觀，不值得因此拒絕整份備份 */
function parsePhotos(value: unknown): Parsed<Record<string, string>> {
  if (value === undefined) return ok({});
  if (!isObject(value)) return err("photos must be an object");
  const photos: Record<string, string> = {};
  for (const [name, data] of Object.entries(value)) {
    if (typeof data !== "string") return err(`photos.${name} must be a string`);
    if (isCoverPhotoName(name)) photos[name] = data;
  }
  return ok(photos);
}

type Parsed<T> = Result<T, string>;

function parseLedgerBackup(value: unknown): Parsed<LedgerBackup> {
  if (!isObject(value)) return err("not an object");
  const ledger = parseLedger(value.ledger);
  if (!ledger.ok) return err(`ledger: ${ledger.error}`);
  const members = parseList(value.members, "members", parseMember);
  if (!members.ok) return members;
  const expenses = parseList(value.expenses, "expenses", parseExpense);
  if (!expenses.ok) return expenses;
  const settlements = parseList(
    value.settlements,
    "settlements",
    parseSettlement,
  );
  if (!settlements.ok) return settlements;
  return ok({
    ledger: ledger.value,
    members: members.value,
    expenses: expenses.value,
    settlements: settlements.value,
  });
}

function parseList<T>(
  value: unknown,
  name: string,
  parse: (item: unknown) => Parsed<T>,
): Parsed<T[]> {
  if (!Array.isArray(value)) return err(`${name} must be an array`);
  const items: T[] = [];
  for (const [index, item] of value.entries()) {
    const parsed = parse(item);
    if (!parsed.ok) return err(`${name}[${index}]: ${parsed.error}`);
    items.push(parsed.value);
  }
  return ok(items);
}

function parseLedger(value: unknown): Parsed<LedgerRecord> {
  if (!isObject(value)) return err("not an object");
  const missing = firstMissing(value, {
    id: isString,
    name: isString,
    baseCurrency: isString,
    createdAt: isString,
    updatedAt: isString,
  });
  if (missing) return err(missing);
  // 1 版沒有 kind，當時只有分帳帳本
  const kind = value.kind ?? "shared";
  if (kind !== "shared" && kind !== "personal") {
    return err(`unknown kind: ${String(kind)}`);
  }
  // 1、2 版沒有封面。認不得的代碼（較新版本的 App 才有的）也當作沒有封面：
  // 封面只影響外觀，不值得因此拒絕整份備份
  const cover = value.cover ?? null;
  if (cover !== null && !isObject(cover)) {
    return err("cover must be an object or null");
  }
  // 1～3 版沒有旅行月份（自動判斷）；格式不對也當作自動，理由同封面
  const tripMonth = isTripMonth(value.tripMonth) ? value.tripMonth : null;
  return ok({
    id: value.id as string,
    kind,
    name: value.name as string,
    baseCurrency: value.baseCurrency as string,
    cover:
      cover &&
      parseCover(cover.style, cover.palette, cover.pattern, cover.photo),
    tripMonth,
    createdAt: value.createdAt as string,
    updatedAt: value.updatedAt as string,
  });
}

function parseMember(value: unknown): Parsed<MemberRecord> {
  if (!isObject(value)) return err("not an object");
  const missing = firstMissing(value, {
    id: isString,
    ledgerId: isString,
    name: isString,
    sortOrder: Number.isInteger,
    archivedAt: isNullableString,
    createdAt: isString,
  });
  if (missing) return err(missing);
  // 1 版沒有 isSelf
  const isSelf = value.isSelf ?? false;
  if (typeof isSelf !== "boolean") return err("invalid isSelf");
  return ok({
    id: value.id as string,
    ledgerId: value.ledgerId as string,
    name: value.name as string,
    sortOrder: value.sortOrder as number,
    archivedAt: value.archivedAt as string | null,
    isSelf,
    createdAt: value.createdAt as string,
  });
}

function parseExpense(value: unknown): Parsed<ExpenseRecord> {
  if (!isObject(value)) return err("not an object");
  const missing = firstMissing(value, {
    id: isString,
    ledgerId: isString,
    payerId: isString,
    amountMinor: Number.isInteger,
    currency: isString,
    title: isString,
    note: isNullableString,
    category: isNullableString,
    placeName: isNullableString,
    occurredAt: isString,
    createdAt: isString,
    updatedAt: isString,
    deletedAt: isNullableString,
  });
  if (missing) return err(missing);

  const fx = parseFx(value.fx);
  if (!fx.ok) return err(`fx: ${fx.error}`);
  const location = parseLocation(value.location);
  if (!location.ok) return err(`location: ${location.error}`);
  const split = decodeSplitRule(JSON.stringify(value.split ?? null));
  if (!split.ok) return err(`split: ${split.error.reason}`);

  return ok({
    id: value.id as string,
    ledgerId: value.ledgerId as string,
    payerId: value.payerId as string,
    amountMinor: value.amountMinor as number,
    currency: value.currency as string,
    fx: fx.value,
    split: split.value,
    title: value.title as string,
    note: value.note as string | null,
    category: value.category as string | null,
    placeName: value.placeName as string | null,
    location: location.value,
    occurredAt: value.occurredAt as string,
    createdAt: value.createdAt as string,
    updatedAt: value.updatedAt as string,
    deletedAt: value.deletedAt as string | null,
  });
}

function parseFx(value: unknown): Parsed<ExpenseFx | null> {
  if (value === null) return ok(null);
  if (!isObject(value) || !isString(value.rateToBase)) {
    return err("rateToBase must be a string");
  }
  if (value.source === "manual") {
    return ok({ rateToBase: value.rateToBase, source: "manual" });
  }
  if (value.source !== "bot-live" && value.source !== "bot-cached") {
    return err(`unknown source: ${String(value.source)}`);
  }
  if (!isString(value.quoteDate)) return err("quoteDate must be a string");
  if (value.basis !== "spot" && value.basis !== "cash") {
    return err(`unknown basis: ${String(value.basis)}`);
  }
  return ok({
    rateToBase: value.rateToBase,
    source: value.source,
    quoteDate: value.quoteDate,
    basis: value.basis,
  });
}

function parseLocation(value: unknown): Parsed<GeoPoint | null> {
  if (value === null || value === undefined) return ok(null);
  if (
    !isObject(value) ||
    typeof value.latitude !== "number" ||
    typeof value.longitude !== "number"
  ) {
    return err("latitude and longitude must be numbers");
  }
  return ok({ latitude: value.latitude, longitude: value.longitude });
}

function parseJournalBackup(value: unknown): Parsed<JournalBackup> {
  if (!isObject(value)) return err("not an object");
  const journal = parseJournal(value.journal);
  if (!journal.ok) return err(`journal: ${journal.error}`);
  const entries = parseList(value.entries, "entries", parseJournalEntry);
  if (!entries.ok) return entries;
  return ok({ journal: journal.value, entries: entries.value });
}

function parseJournal(value: unknown): Parsed<JournalRecord> {
  if (!isObject(value)) return err("not an object");
  const missing = firstMissing(value, {
    id: isString,
    name: isString,
    ledgerId: isNullableString,
    createdAt: isString,
    updatedAt: isString,
  });
  if (missing) return err(missing);
  // 封面只影響外觀：認不得的紙膠帶、格式不對的照片檔名都退回預設，不拒絕整份備份
  const cover = isObject(value.cover) ? value.cover : {};
  return ok({
    id: value.id as string,
    name: value.name as string,
    ledgerId: value.ledgerId as string | null,
    cover: parseJournalCover(cover.tape, cover.photo),
    createdAt: value.createdAt as string,
    updatedAt: value.updatedAt as string,
  });
}

function parseJournalEntry(value: unknown): Parsed<JournalEntryRecord> {
  if (!isObject(value)) return err("not an object");
  const missing = firstMissing(value, {
    id: isString,
    journalId: isString,
    date: isLocalDate,
    title: isString,
    body: isString,
    createdAt: isString,
    updatedAt: isString,
    deletedAt: isNullableString,
  });
  if (missing) return err(missing);
  if (!Array.isArray(value.photos)) return err("photos must be an array");
  const places = parseList(value.places, "places", parsePlace);
  if (!places.ok) return places;
  const stickers = parseStickers(value.stickers);
  if (!stickers.ok) return stickers;
  return ok({
    id: value.id as string,
    journalId: value.journalId as string,
    date: value.date as string,
    title: value.title as string,
    body: value.body as string,
    // 認不得的印章（較新版本的 App 才有的）當作沒選，理由同封面
    weather: isJournalWeather(value.weather) ? value.weather : null,
    mood: isJournalMood(value.mood) ? value.mood : null,
    // 檔名格式不對的照片不收，免得指到資料夾外面
    photos: value.photos.filter(isCoverPhotoName),
    places: places.value,
    stickers: stickers.value,
    createdAt: value.createdAt as string,
    updatedAt: value.updatedAt as string,
    deletedAt: value.deletedAt as string | null,
  });
}

/**
 * 1～6 版的日記沒有 stickers。貼紙只影響外觀，數值不對的那張丟掉、
 * 超過上限的不收，不拒絕整份備份
 */
function parseStickers(value: unknown): Parsed<EntrySticker[]> {
  if (value === undefined) return ok([]);
  if (!Array.isArray(value)) return err("stickers must be an array");
  return ok(
    value
      .map(parseSticker)
      .flatMap((sticker) => (sticker.ok ? [sticker.value] : []))
      .slice(0, ENTRY_STICKER_LIMIT),
  );
}

function parseIllustration(value: unknown): Parsed<IllustrationRecord> {
  if (!isObject(value)) return err("not an object");
  const missing = firstMissing(value, {
    id: isString,
    createdAt: isString,
    updatedAt: isString,
  });
  if (missing) return err(missing);
  const strokes = parseStrokes(value.strokes);
  if (!strokes.ok) return strokes;
  return ok({
    id: value.id as string,
    strokes: strokes.value,
    createdAt: value.createdAt as string,
    updatedAt: value.updatedAt as string,
  });
}

function parsePlace(value: unknown): Parsed<JournalPlace> {
  if (!isObject(value) || !isString(value.name)) return err("invalid name");
  const location = parseLocation(value.location);
  if (!location.ok) return location;
  if (location.value === null) return err("missing location");
  return ok({ name: value.name, location: location.value });
}

function parseSettlement(value: unknown): Parsed<SettlementRecord> {
  if (!isObject(value)) return err("not an object");
  const missing = firstMissing(value, {
    id: isString,
    ledgerId: isString,
    fromId: isString,
    toId: isString,
    amountMinor: Number.isInteger,
    settledAt: isString,
    createdAt: isString,
    updatedAt: isString,
    deletedAt: isNullableString,
  });
  if (missing) return err(missing);
  return ok({
    id: value.id as string,
    ledgerId: value.ledgerId as string,
    fromId: value.fromId as string,
    toId: value.toId as string,
    amountMinor: value.amountMinor as number,
    settledAt: value.settledAt as string,
    createdAt: value.createdAt as string,
    updatedAt: value.updatedAt as string,
    deletedAt: value.deletedAt as string | null,
  });
}

/** 回傳第一個型別不符的欄位說明，全部符合時回傳 null */
function firstMissing(
  value: Record<string, unknown>,
  checks: Record<string, (field: unknown) => boolean>,
): string | null {
  for (const [key, check] of Object.entries(checks)) {
    if (!check(value[key])) return `invalid ${key}`;
  }
  return null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}

function invalid(reason: string): Result<never, BackupFileError> {
  return err({ code: "INVALID_BACKUP", reason });
}
