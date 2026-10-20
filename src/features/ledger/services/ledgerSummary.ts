import { err, ok, type Result } from "../../../domain/common/result";
import {
  computeBalances,
  computeLedgerStats,
  convertToBase,
  findExpenseStatuses,
  simplifyDebts,
  toExpense,
  toLedger,
  toSettlement,
  type Balances,
  type ExpenseRecord,
  type ExpenseStatus,
  type LedgerError,
  type LedgerRecord,
  type LedgerStats,
  type MemberRecord,
  type SettlementRecord,
  type Transfer,
} from "../../../domain/ledger";
import type { SqlExecutor } from "../../../data/db/sqlDatabase";
import { createRepositories } from "../../../data/repositories";

export interface LedgerSummary {
  readonly ledger: LedgerRecord;
  /** 依加入順序，包含已封存的成員 */
  readonly members: readonly MemberRecord[];
  /** 依消費時間由舊到新，不含已刪除的消費 */
  readonly expenses: readonly ExpenseRecord[];
  readonly settlements: readonly SettlementRecord[];
  /** 每位成員的淨額（基準幣最小單位）：正數 = 別人欠他 */
  readonly balances: Balances;
  /** 最少筆數的還款建議 */
  readonly transfers: readonly Transfer[];
  /** 消費 id → 換算成基準幣的金額（最小單位），與結餘計算使用同一個換算 */
  readonly expenseBaseAmounts: ReadonlyMap<string, number>;
  /** 消費 id → 已結清／已抵銷，沒有狀態的消費不在其中；規則見 findExpenseStatuses */
  readonly expenseStatuses: ReadonlyMap<string, ExpenseStatus>;
}

export type LedgerSummaryError =
  | LedgerError
  | { readonly code: "LEDGER_NOT_FOUND"; readonly ledgerId: string };

/** 讀出帳本的所有資料，並算出結餘與還款建議 */
export async function loadLedgerSummary(
  db: SqlExecutor,
  ledgerId: string,
): Promise<Result<LedgerSummary, LedgerSummaryError>> {
  const repos = createRepositories(db);
  const ledgerRecord = await repos.ledgers.findById(ledgerId);
  if (!ledgerRecord) return err({ code: "LEDGER_NOT_FOUND", ledgerId });

  const [members, expenses, settlements] = await Promise.all([
    repos.members.listByLedger(ledgerId),
    repos.expenses.listByLedger(ledgerId),
    repos.settlements.listByLedger(ledgerId),
  ]);
  const ledger = toLedger(ledgerRecord, members);

  const balances = computeBalances(
    ledger,
    expenses.map(toExpense),
    settlements.map(toSettlement),
  );
  if (!balances.ok) return balances;
  const transfers = simplifyDebts(balances.value, ledger);
  if (!transfers.ok) return transfers;
  const expenseBaseAmounts = new Map<string, number>();
  for (const expense of expenses) {
    const base = convertToBase(
      expense.amountMinor,
      expense.currency,
      ledger.baseCurrency,
      expense.fx?.rateToBase,
    );
    if (!base.ok) {
      return err({
        code: "INVALID_EXPENSE",
        expenseId: expense.id,
        cause: base.error,
      });
    }
    expenseBaseAmounts.set(expense.id, base.value);
  }
  const expenseStatuses = findExpenseStatuses(ledger, expenses, settlements);
  if (!expenseStatuses.ok) return expenseStatuses;

  return ok({
    ledger: ledgerRecord,
    members,
    expenses,
    settlements,
    balances: balances.value,
    transfers: transfers.value,
    expenseBaseAmounts,
    expenseStatuses: expenseStatuses.value,
  });
}

export interface LedgerStatsView {
  readonly ledger: LedgerRecord;
  /** 依加入順序，包含已封存的成員 */
  readonly members: readonly MemberRecord[];
  readonly stats: LedgerStats;
}

/** 讀出帳本的花費統計（每人付出與負擔、各分類合計），金額為基準幣 */
export async function loadLedgerStats(
  db: SqlExecutor,
  ledgerId: string,
): Promise<Result<LedgerStatsView, LedgerSummaryError>> {
  const repos = createRepositories(db);
  const ledger = await repos.ledgers.findById(ledgerId);
  if (!ledger) return err({ code: "LEDGER_NOT_FOUND", ledgerId });

  const [members, expenses] = await Promise.all([
    repos.members.listByLedger(ledgerId),
    repos.expenses.listByLedger(ledgerId),
  ]);
  const stats = computeLedgerStats(toLedger(ledger, members), expenses);
  if (!stats.ok) return stats;
  return ok({ ledger, members, stats: stats.value });
}
