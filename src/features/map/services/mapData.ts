import type { SqlExecutor } from "../../../data/db/sqlDatabase";
import { createRepositories } from "../../../data/repositories";
import {
  formatMinorAmount,
  type LedgerKind,
  type LedgerRecord,
  type LocatedExpenseRecord,
} from "../../../domain/ledger";
import { localDateOf, type MapPin } from "../../../domain/map";

export interface MapLedger {
  readonly id: string;
  readonly name: string;
  /** 個人帳本的消費要用個人分頁的畫面編輯 */
  readonly kind: LedgerKind;
}

export interface MapData {
  /** 依消費時間由舊到新 */
  readonly pins: readonly MapPin[];
  /** 有地點的帳本，依帳本列表的順序（新到舊），給篩選用 */
  readonly ledgers: readonly MapLedger[];
}

/** 讀取所有帳本中有座標的消費，轉成地圖上的 pin */
export async function loadMapData(db: SqlExecutor): Promise<MapData> {
  const repos = createRepositories(db);
  const [ledgers, expenses] = await Promise.all([
    repos.ledgers.list(),
    repos.expenses.listWithLocation(),
  ]);
  return buildMapData(ledgers, expenses);
}

export function buildMapData(
  ledgers: readonly LedgerRecord[],
  expenses: readonly LocatedExpenseRecord[],
): MapData {
  const usedLedgerIds = new Set(expenses.map((e) => e.ledgerId));
  return {
    pins: expenses.map(toExpensePin),
    ledgers: ledgers
      .filter((l) => usedLedgerIds.has(l.id))
      .map((l) => ({ id: l.id, name: l.name, kind: l.kind })),
  };
}

export interface PinFilter {
  /** null 代表全部帳本 */
  readonly ledgerId: string | null;
  /** 當地日期 YYYY-MM-DD；null 代表全部日期 */
  readonly date: string | null;
}

export function filterPins(
  pins: readonly MapPin[],
  { ledgerId, date }: PinFilter,
): readonly MapPin[] {
  if (ledgerId === null && date === null) return pins;
  return pins.filter(
    (p) =>
      (ledgerId === null || p.ledgerId === ledgerId) &&
      (date === null || localDateOf(p) === date),
  );
}

function toExpensePin(expense: LocatedExpenseRecord): MapPin {
  const amount = `${expense.currency} ${formatMinorAmount(expense.amountMinor, expense.currency)}`;
  return {
    kind: "expense",
    id: expense.id,
    ledgerId: expense.ledgerId,
    title: expense.title,
    subtitle: expense.placeName ? `${amount} · ${expense.placeName}` : amount,
    point: expense.location,
    occurredAt: expense.occurredAt,
  };
}
