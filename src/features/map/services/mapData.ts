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
import {
  localDateOf,
  type ExpenseMapPin,
  type MapPin,
} from "../../../domain/map";
import { tripMonthOf } from "../../ledger/services/ledgerOverview";

export interface MapLedger {
  readonly id: string;
  readonly name: string;
  /** 個人帳本的消費要用個人分頁的畫面編輯 */
  readonly kind: LedgerKind;
  /** 地球上索引籤與標記的顏色；沒存封面的帳本用 coverFromId 補 */
  readonly cover: LedgerCover;
  /** 旅行月份 YYYY-MM，地球的索引籤依年份分組 */
  readonly tripMonth: string;
}

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
  /** 有座標的消費，依消費時間由舊到新 */
  readonly pins: readonly MapExpense[];
  /**
   * 所有帳本（沒有地點的也列出來，地球的索引籤要用）：
   * 個人帳本在最前面，分帳帳本依旅行月份由新到舊，同月份依建立時間由新到舊
   */
  readonly ledgers: readonly MapLedger[];
}

/** 讀取所有帳本與其中有座標的消費 */
export async function loadMapData(db: SqlExecutor): Promise<MapData> {
  const repos = createRepositories(db);
  const [ledgers, expenses] = await Promise.all([
    repos.ledgers.list(),
    repos.expenses.listWithLocation(),
  ]);
  // 旅行月份沒有手動指定時要看最早的一筆消費（包含沒有座標的）
  const entries = await Promise.all(
    ledgers.map(async (ledger) => ({
      ledger,
      tripMonth:
        ledger.tripMonth ??
        tripMonthOf(ledger, await repos.expenses.listByLedger(ledger.id)),
    })),
  );
  return buildMapData(entries, expenses);
}

export function buildMapData(
  ledgers: readonly { ledger: LedgerRecord; tripMonth: string }[],
  expenses: readonly LocatedExpenseRecord[],
): MapData {
  const ledgerById = new Map(ledgers.map((l) => [l.ledger.id, l.ledger]));
  const mapLedgers = ledgers.map(({ ledger, tripMonth }) => ({
    id: ledger.id,
    name: ledger.name,
    kind: ledger.kind,
    cover: ledger.cover ?? coverFromId(ledger.id),
    tripMonth,
  }));
  // sort is stable, so ledgers in the same month keep the list order (newest first)
  const sorted = [...mapLedgers].sort((a, b) =>
    a.kind !== b.kind
      ? a.kind === "personal"
        ? -1
        : 1
      : b.tripMonth.localeCompare(a.tripMonth),
  );
  return {
    pins: expenses.map((e) => toMapExpense(e, ledgerById.get(e.ledgerId))),
    ledgers: sorted,
  };
}

export interface PinFilter {
  /** null 代表全部帳本 */
  readonly ledgerId: string | null;
  /** 當地日期 YYYY-MM-DD；null 代表全部日期 */
  readonly date: string | null;
}

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
