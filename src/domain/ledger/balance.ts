import { err, ok, type Result } from "../common/result";
import type { LedgerError } from "./errors";
import { validateSettlement } from "./settlement";
import { computeShares } from "./split";
import type {
  Balances,
  Expense,
  Ledger,
  MemberId,
  Settlement,
  Shares,
} from "./types";

/**
 * 由消費與結算紀錄推導每位成員的淨額。餘額永遠是推導值，不應另外儲存。
 * 已軟刪除（deletedAt 有值）的紀錄會被忽略。
 *
 * 任何一筆已存資料不合法時回傳錯誤並附上該筆 id，
 * 讓 UI 能指出是哪筆資料有問題，而不是整個畫面崩潰。
 */
export function computeBalances(
  ledger: Ledger,
  expenses: readonly Expense[],
  settlements: readonly Settlement[],
): Result<Balances, LedgerError> {
  const balances = new Map<MemberId, number>(
    ledger.members.map((m) => [m.id, 0]),
  );

  for (const expense of expenses.filter(isActive)) {
    const shares = computeShares(expense, ledger);
    if (!shares.ok) {
      return err({
        code: "INVALID_EXPENSE",
        expenseId: expense.id,
        cause: shares.error,
      });
    }
    applyExpense(balances, expense.payerId, shares.value);
  }

  for (const settlement of settlements.filter(isActive)) {
    const valid = validateSettlement(settlement, ledger);
    if (!valid.ok) {
      return err({
        code: "INVALID_SETTLEMENT",
        settlementId: settlement.id,
        cause: valid.error,
      });
    }
    applySettlement(balances, settlement);
  }

  return ok(balances);
}

function isActive(record: { deletedAt?: string | null }): boolean {
  return record.deletedAt == null;
}

/**
 * 付款人墊付了全部份額的總和；每位參與者各自負擔自己的份額。
 * 只給 ledger 模組內部使用（例如依記錄順序重播），不從 index.ts 公開。
 */
export function applyExpense(
  balances: Map<MemberId, number>,
  payerId: MemberId,
  shares: Shares,
): void {
  let paid = 0;
  for (const [memberId, share] of shares) {
    paid += share;
    addTo(balances, memberId, -share);
  }
  addTo(balances, payerId, paid);
}

/** 付錢的人欠款減少，收錢的人應收減少。只給 ledger 模組內部使用 */
export function applySettlement(
  balances: Map<MemberId, number>,
  settlement: Settlement,
): void {
  addTo(balances, settlement.fromId, settlement.amountMinor);
  addTo(balances, settlement.toId, -settlement.amountMinor);
}

function addTo(
  balances: Map<MemberId, number>,
  memberId: MemberId,
  delta: number,
): void {
  balances.set(memberId, (balances.get(memberId) ?? 0) + delta);
}
