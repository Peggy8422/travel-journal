import { err, ok, type Result } from "../common/result";
import type { LedgerError } from "./errors";
import { toExpense, type ExpenseRecord } from "./records";
import { computeShares } from "./split";
import type { Ledger, MemberId } from "./types";

/** 單一成員的花費（基準幣最小單位） */
export interface MemberSpending {
  readonly memberId: MemberId;
  /** 實際付出去的金額（墊付總額） */
  readonly paidMinor: number;
  /** 應該負擔的金額（自己的份額總和） */
  readonly shareMinor: number;
}

export interface CategoryTotal {
  /** null 代表未分類 */
  readonly category: string | null;
  readonly totalMinor: number;
}

export interface LedgerStats {
  /** 消費總額（基準幣） */
  readonly totalMinor: number;
  /** 依成員加入順序 */
  readonly members: readonly MemberSpending[];
  /** 依金額由大到小，同金額依分類名稱排序 */
  readonly categories: readonly CategoryTotal[];
}

/**
 * 彙總帳本的花費統計，金額一律換算成基準幣，換算方式與結餘相同。
 * 只計算消費，不含還款；已刪除的消費不計入。
 * 分類目前是自由文字，依原文分組。
 */
export function computeLedgerStats(
  ledger: Ledger,
  expenses: readonly ExpenseRecord[],
): Result<LedgerStats, LedgerError> {
  const paid = new Map<MemberId, number>();
  const share = new Map<MemberId, number>();
  const byCategory = new Map<string | null, number>();
  let totalMinor = 0;

  for (const record of expenses.filter((e) => e.deletedAt === null)) {
    const shares = computeShares(toExpense(record), ledger);
    if (!shares.ok) {
      return err({
        code: "INVALID_EXPENSE",
        expenseId: record.id,
        cause: shares.error,
      });
    }
    let expenseTotal = 0;
    for (const [memberId, amount] of shares.value) {
      expenseTotal += amount;
      share.set(memberId, (share.get(memberId) ?? 0) + amount);
    }
    paid.set(record.payerId, (paid.get(record.payerId) ?? 0) + expenseTotal);
    byCategory.set(
      record.category,
      (byCategory.get(record.category) ?? 0) + expenseTotal,
    );
    totalMinor += expenseTotal;
  }

  return ok({
    totalMinor,
    members: ledger.members.map((m) => ({
      memberId: m.id,
      paidMinor: paid.get(m.id) ?? 0,
      shareMinor: share.get(m.id) ?? 0,
    })),
    categories: [...byCategory]
      .map(([category, total]) => ({ category, totalMinor: total }))
      .sort(
        (a, b) =>
          b.totalMinor - a.totalMinor ||
          (a.category ?? "").localeCompare(b.category ?? ""),
      ),
  });
}
