import type { SqlExecutor } from "../../../data/db/sqlDatabase";
import { createRepositories } from "../../../data/repositories";
import { err, ok, type Result } from "../../../domain/common/result";
import {
  computeShares,
  toExpense,
  toLedger,
  type ExpenseRecord,
  type ExpenseStatus,
  type LedgerRecord,
  type MemberRecord,
} from "../../../domain/ledger";
import { loadLedgerSummary, type LedgerSummaryError } from "./ledgerSummary";

/** 消費明細頁（只能看）要顯示的內容 */
export interface ExpenseDetail {
  readonly expense: ExpenseRecord;
  readonly ledger: LedgerRecord;
  /** 付款人；個人消費是「我」 */
  readonly payer: MemberRecord | undefined;
  /** 換算成帳本基準幣的金額（最小單位），與結餘計算使用同一個換算 */
  readonly baseMinor: number;
  /** 每位分攤成員負擔的基準幣金額，依成員加入順序 */
  readonly shares: readonly {
    readonly member: MemberRecord;
    readonly amountMinor: number;
  }[];
  /** 已結清／已抵銷；沒有狀態時為 undefined */
  readonly status: ExpenseStatus | undefined;
}

export type ExpenseDetailError =
  | LedgerSummaryError
  | { readonly code: "EXPENSE_NOT_FOUND"; readonly expenseId: string };

/** 讀出一筆消費（分帳或個人）與它所在帳本算出的分攤；已刪除的消費視為找不到 */
export async function loadExpenseDetail(
  db: SqlExecutor,
  expenseId: string,
): Promise<Result<ExpenseDetail, ExpenseDetailError>> {
  const record = await createRepositories(db).expenses.findById(expenseId);
  if (!record || record.deletedAt !== null) {
    return err({ code: "EXPENSE_NOT_FOUND", expenseId });
  }
  const summary = await loadLedgerSummary(db, record.ledgerId);
  if (!summary.ok) return summary;
  const { ledger, members, expenseBaseAmounts, expenseStatuses } =
    summary.value;

  const shares = computeShares(toExpense(record), toLedger(ledger, members));
  if (!shares.ok) return shares;
  return ok({
    expense: record,
    ledger,
    payer: members.find((m) => m.id === record.payerId),
    baseMinor: expenseBaseAmounts.get(record.id) ?? 0,
    shares: members.flatMap((member) => {
      const amountMinor = shares.value.get(member.id);
      return amountMinor === undefined ? [] : [{ member, amountMinor }];
    }),
    status: expenseStatuses.get(record.id),
  });
}
