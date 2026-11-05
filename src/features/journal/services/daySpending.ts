import {
  convertToBase,
  type CurrencyCode,
  type ExpenseRecord,
  type LedgerRecord,
  type MemberRecord,
} from "../../../domain/ledger";
import type { Repositories } from "../../../data/repositories";

/*
 * 日記頁「這天的消費」：手帳綁定的帳本在日記那天（消費當地日期）記的消費。
 * 只是把帳本的資料列出來，不另外存。
 */

export interface DaySpendingRow {
  readonly expense: ExpenseRecord;
  readonly payerName: string;
  /** 換算成帳本基準幣的金額；匯率資料有誤時為 null，不算進合計 */
  readonly baseMinor: number | null;
}

export interface DaySpending {
  readonly ledger: LedgerRecord;
  /** 依消費時間由早到晚 */
  readonly rows: readonly DaySpendingRow[];
  /**
   * 合計：每筆都是同一個幣別時用那個幣別（在日本一整天都是 JPY），
   * 混了不同幣別時換算成帳本的基準幣。沒有消費時為 null。
   */
  readonly total: {
    readonly currency: CurrencyCode;
    readonly amountMinor: number;
  } | null;
}

/** expenses 依消費時間排好（repository 的順序），不含已刪除的消費 */
export function daySpendingOf(
  ledger: LedgerRecord,
  members: readonly MemberRecord[],
  expenses: readonly ExpenseRecord[],
  date: string,
): DaySpending {
  const names = new Map(members.map((m) => [m.id, m.name]));
  const rows = expenses
    // The local date is the start of the timestamp, before the offset
    .filter((e) => e.occurredAt.slice(0, 10) === date)
    .map((expense) => {
      const base = convertToBase(
        expense.amountMinor,
        expense.currency,
        ledger.baseCurrency,
        expense.fx?.rateToBase,
      );
      return {
        expense,
        payerName: names.get(expense.payerId) ?? "",
        baseMinor: base.ok ? base.value : null,
      };
    });
  return { ledger, rows, total: totalOf(ledger, rows) };
}

function totalOf(
  ledger: LedgerRecord,
  rows: readonly DaySpendingRow[],
): DaySpending["total"] {
  if (rows.length === 0) return null;
  const currencies = new Set(rows.map((r) => r.expense.currency));
  if (currencies.size === 1) {
    return {
      currency: rows[0].expense.currency,
      amountMinor: rows.reduce((sum, r) => sum + r.expense.amountMinor, 0),
    };
  }
  return {
    currency: ledger.baseCurrency,
    amountMinor: rows.reduce((sum, r) => sum + (r.baseMinor ?? 0), 0),
  };
}

/** 綁定的帳本已經不在時回傳 null（手帳照樣顯示，只是沒有這一段） */
export async function loadDaySpending(
  repos: Repositories,
  ledgerId: string,
  date: string,
): Promise<DaySpending | null> {
  const ledger = await repos.ledgers.findById(ledgerId);
  if (!ledger) return null;
  const [members, expenses] = await Promise.all([
    repos.members.listByLedger(ledgerId),
    repos.expenses.listByLedger(ledgerId),
  ]);
  return daySpendingOf(ledger, members, expenses, date);
}
