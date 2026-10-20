import type { SqlExecutor } from "../../../data/db/sqlDatabase";
import { createRepositories } from "../../../data/repositories";
import {
  formatMinorAmount,
  type LedgerRecord,
  type LocatedExpenseRecord,
} from "../../../domain/ledger";
import type { MapPin } from "../../../domain/map";

export interface MapLedger {
  readonly id: string;
  readonly name: string;
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
      .map((l) => ({ id: l.id, name: l.name })),
  };
}

/** ledgerId 為 null 代表全部帳本 */
export function filterPins(
  pins: readonly MapPin[],
  ledgerId: string | null,
): readonly MapPin[] {
  return ledgerId === null ? pins : pins.filter((p) => p.ledgerId === ledgerId);
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
