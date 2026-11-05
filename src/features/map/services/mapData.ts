import type { SqlExecutor } from "../../../data/db/sqlDatabase";
import { createRepositories } from "../../../data/repositories";
import {
  convertToBase,
  coverFromId,
  formatMinorAmount,
  type CurrencyCode,
  type LedgerCover,
  type LedgerKind,
  type LedgerRecord,
  type LocatedExpenseRecord,
} from "../../../domain/ledger";
import type {
  JournalEntryRecord,
  JournalRecord,
} from "../../../domain/journal";
import {
  localDateOf,
  type ExpenseMapPin,
  type JournalMapPin,
  type MapPin,
} from "../../../domain/map";
import { entryHeading } from "../../journal/services/journalDates";
import { tripMonthOf } from "../../ledger/services/ledgerOverview";

/**
 * 沒綁帳本的手帳在地球上共用一張「手帳」索引籤，用這個 id 當作它們的帳本；
 * 帳本 id 是 UUID，不會撞到
 */
export const UNBOUND_JOURNALS_ID = "journals:unbound";

/** 地球上索引籤的種類：分帳帳本、個人記帳，或沒綁帳本的手帳 */
export type MapLedgerKind = LedgerKind | "journals";

export interface MapLedger {
  readonly id: string;
  readonly name: string;
  readonly kind: MapLedgerKind;
  /** 地球上索引籤與標記的顏色；沒存封面的帳本用 coverFromId 補 */
  readonly cover: LedgerCover;
  /** 旅行月份 YYYY-MM，地球的索引籤依年份分組 */
  readonly tripMonth: string;
  /**
   * 帳本裡的消費筆數（含沒有地點的）；個人記帳一筆都沒有時索引籤淡化、不能點。
   * 「手帳」索引籤是沒綁帳本的手帳裡的日記篇數
   */
  readonly expenseCount: number;
}

/** 地圖上的一個點：有座標的消費，或日記裡的一個地點 */
export type MapItem = MapExpense | JournalMapPin;

/** 地圖上的一筆消費：pin 之外再帶地球消費卡片要顯示的金額與分類 */
export interface MapExpense extends ExpenseMapPin {
  readonly category: string | null;
  readonly placeName: string | null;
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
  /** 換算成帳本基準幣（新台幣）的金額；匯率資料有誤算不出來時為 null */
  readonly baseMinor: number | null;
}

export interface MapData {
  /** 有座標的消費依消費時間由舊到新，接著是日記的地點，依日記日期由舊到新 */
  readonly pins: readonly MapItem[];
  /**
   * 所有帳本（沒有地點的也列出來，地球的索引籤要用）：
   * 個人帳本在最前面，接著是有日記的「手帳」索引籤，
   * 分帳帳本依旅行月份由新到舊，同月份依建立時間由新到舊
   */
  readonly ledgers: readonly MapLedger[];
}

/** 一本手帳與其中（沒刪除的）日記 */
export interface MapJournal {
  readonly journal: JournalRecord;
  readonly entries: readonly JournalEntryRecord[];
}

/** 讀取所有帳本與其中有座標的消費，以及日記的地點 */
export async function loadMapData(db: SqlExecutor): Promise<MapData> {
  const repos = createRepositories(db);
  const [ledgers, expenses, journals] = await Promise.all([
    repos.ledgers.list(),
    repos.expenses.listWithLocation(),
    repos.journals.list(),
  ]);
  const journalEntries = await Promise.all(
    journals.map(async (journal) => ({
      journal,
      entries: await repos.journalEntries.listByJournal(journal.id),
    })),
  );
  // 旅行月份沒有手動指定時要看最早的一筆消費（包含沒有座標的）
  const entries = await Promise.all(
    ledgers.map(async (ledger) => {
      const all = await repos.expenses.listByLedger(ledger.id);
      return {
        ledger,
        tripMonth: ledger.tripMonth ?? tripMonthOf(ledger, all),
        expenseCount: all.length,
      };
    }),
  );
  return buildMapData(entries, expenses, journalEntries);
}

export function buildMapData(
  ledgers: readonly {
    ledger: LedgerRecord;
    tripMonth: string;
    expenseCount: number;
  }[],
  expenses: readonly LocatedExpenseRecord[],
  journals: readonly MapJournal[] = [],
): MapData {
  const ledgerById = new Map(ledgers.map((l) => [l.ledger.id, l.ledger]));
  const mapLedgers: MapLedger[] = ledgers.map(
    ({ ledger, tripMonth, expenseCount }) => ({
      id: ledger.id,
      name: ledger.name,
      kind: ledger.kind,
      cover: ledger.cover ?? coverFromId(ledger.id),
      tripMonth,
      expenseCount,
    }),
  );
  const unbound = journals.filter((j) => j.journal.ledgerId === null);
  const unboundEntries = unbound.reduce((n, j) => n + j.entries.length, 0);
  if (unboundEntries > 0) {
    mapLedgers.push({
      id: UNBOUND_JOURNALS_ID,
      name: "手帳",
      kind: "journals",
      cover: coverFromId(UNBOUND_JOURNALS_ID),
      tripMonth: "",
      expenseCount: unboundEntries,
    });
  }
  // sort is stable, so ledgers in the same month keep the list order (newest first)
  const sorted = [...mapLedgers].sort((a, b) =>
    a.kind !== b.kind
      ? KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
      : b.tripMonth.localeCompare(a.tripMonth),
  );
  const places = journals
    .flatMap(({ journal, entries }) =>
      entries.flatMap((entry) => journalPins(journal, entry)),
    )
    // sort is stable, so places of one day keep the journal order
    .sort((a, b) => a.date.localeCompare(b.date));
  return {
    pins: [
      ...expenses.map((e) => toMapExpense(e, ledgerById.get(e.ledgerId))),
      ...places,
    ],
    ledgers: sorted,
  };
}

const KIND_ORDER: Readonly<Record<MapLedgerKind, number>> = {
  personal: 0,
  journals: 1,
  shared: 2,
};

/** 索引籤以外顯示帳本名稱的地方（卡片標題、篩選、分段小標） */
export function mapLedgerName(ledger: MapLedger): string {
  switch (ledger.kind) {
    case "personal":
      return "個人記帳";
    case "journals":
      return "未綁帳本的手帳";
    case "shared":
      return ledger.name;
  }
}

function journalPins(
  journal: JournalRecord,
  entry: JournalEntryRecord,
): JournalMapPin[] {
  if (entry.deletedAt !== null) return [];
  return entry.places.map((place, index) => ({
    kind: "journal",
    id: `${entry.id}:${index}`,
    entryId: entry.id,
    journalId: journal.id,
    ledgerId: journal.ledgerId ?? UNBOUND_JOURNALS_ID,
    title: entryHeading(entry),
    placeName: place.name,
    point: place.location,
    date: entry.date,
  }));
}

export interface PinFilter {
  /** null 代表全部帳本 */
  readonly ledgerId: string | null;
  /** 當地日期 YYYY-MM-DD；null 代表全部日期 */
  readonly date: string | null;
}

/** 依帳本與日期篩選；日記的地點跟著它的手帳綁定的帳本 */
export function filterPins<T extends MapPin>(
  pins: readonly T[],
  { ledgerId, date }: PinFilter,
): readonly T[] {
  if (ledgerId === null && date === null) return pins;
  return pins.filter(
    (p) =>
      (ledgerId === null || p.ledgerId === ledgerId) &&
      (date === null || localDateOf(p) === date),
  );
}

function toMapExpense(
  expense: LocatedExpenseRecord,
  ledger: LedgerRecord | undefined,
): MapExpense {
  const amount = `${expense.currency} ${formatMinorAmount(expense.amountMinor, expense.currency)}`;
  const base = ledger
    ? convertToBase(
        expense.amountMinor,
        expense.currency,
        ledger.baseCurrency,
        expense.fx?.rateToBase,
      )
    : undefined;
  return {
    kind: "expense",
    id: expense.id,
    ledgerId: expense.ledgerId,
    title: expense.title,
    subtitle: expense.placeName ? `${amount} · ${expense.placeName}` : amount,
    point: expense.location,
    occurredAt: expense.occurredAt,
    category: expense.category,
    placeName: expense.placeName,
    amountMinor: expense.amountMinor,
    currency: expense.currency,
    baseMinor: base?.ok ? base.value : null,
  };
}
