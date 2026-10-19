import { err, ok, type Result } from "../../../domain/common/result";
import {
  computeBalances,
  simplifyDebts,
  toExpense,
  toLedger,
  toSettlement,
  type Balances,
  type ExpenseRecord,
  type LedgerError,
  type LedgerRecord,
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

  return ok({
    ledger: ledgerRecord,
    members,
    expenses,
    settlements,
    balances: balances.value,
    transfers: transfers.value,
  });
}
