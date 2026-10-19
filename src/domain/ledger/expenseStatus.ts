import { err, ok, type Result } from "../common/result";
import { applyExpense, applySettlement } from "./balance";
import type { LedgerError } from "./errors";
import {
  expenseMemberIds,
  toExpense,
  toSettlement,
  type ExpenseRecord,
  type SettlementRecord,
} from "./records";
import { validateSettlement } from "./settlement";
import { computeShares } from "./split";
import type { Ledger, MemberId, Shares } from "./types";

/**
 * 消費的結清狀態：
 * - settled（已結清）：涉及的人結餘歸零，過程中有人實際還過錢
 * - offset（已抵銷）：涉及的人結餘因為其他消費互相抵掉而歸零，過程中沒有人還過錢
 */
export type ExpenseStatus = "settled" | "offset";

type RecordedEvent =
  | {
      readonly kind: "expense";
      readonly record: ExpenseRecord;
      readonly shares: Shares;
    }
  | { readonly kind: "settlement"; readonly record: SettlementRecord };

/**
 * 推導每筆消費的結清狀態，沒有狀態的消費不會出現在結果中。
 *
 * 還款建議是依淨額計算，一筆還款無法對應到特定消費，所以改用這個規則：
 * 依記錄時間（createdAt）重播所有消費與還款，每個事件之後檢查結餘；
 * 某筆消費記錄之後，涉及的所有人（付款人與分攤者）結餘第一次同時歸零時決定狀態，
 * 之後不再改變：從記錄到歸零之間，涉及的人有任何一筆還款 → settled，否則 → offset。
 * 例如先有人還了一部分，再由另一筆消費補平，仍然算 settled，因為確實有人還過錢。
 *
 * - 用記錄時間而不是消費時間排序，事後補記、消費時間較早的消費才不會被之前的還款誤判。
 * - 只有付款人自己分攤的消費本來就沒有欠款，不給狀態。
 * - 結果每次重新推導、不另外儲存，刪除或修改消費、還款後會自動更新。
 */
export function findExpenseStatuses(
  ledger: Ledger,
  expenses: readonly ExpenseRecord[],
  settlements: readonly SettlementRecord[],
): Result<ReadonlyMap<string, ExpenseStatus>, LedgerError> {
  const events: RecordedEvent[] = [];
  for (const record of expenses.filter((e) => e.deletedAt === null)) {
    const shares = computeShares(toExpense(record), ledger);
    if (!shares.ok) {
      return err({
        code: "INVALID_EXPENSE",
        expenseId: record.id,
        cause: shares.error,
      });
    }
    events.push({ kind: "expense", record, shares: shares.value });
  }
  for (const record of settlements.filter((s) => s.deletedAt === null)) {
    const valid = validateSettlement(toSettlement(record), ledger);
    if (!valid.ok) {
      return err({
        code: "INVALID_SETTLEMENT",
        settlementId: record.id,
        cause: valid.error,
      });
    }
    events.push({ kind: "settlement", record });
  }
  events.sort(byRecordedOrder);

  const balances = new Map<MemberId, number>(
    ledger.members.map((m) => [m.id, 0]),
  );
  const statuses = new Map<string, ExpenseStatus>();
  let pending: { expense: ExpenseRecord; members: MemberId[] }[] = [];
  /** 記錄之後，涉及的人有人還過錢的消費 */
  const repaid = new Set<string>();

  for (const event of events) {
    if (event.kind === "expense") {
      applyExpense(balances, event.record.payerId, event.shares);
      if (createsDebt(event.record.payerId, event.shares)) {
        pending.push({
          expense: event.record,
          members: expenseMemberIds(event.record),
        });
      }
    } else {
      const settlement = toSettlement(event.record);
      applySettlement(balances, settlement);
      for (const { expense, members } of pending) {
        if (
          members.includes(settlement.fromId) ||
          members.includes(settlement.toId)
        ) {
          repaid.add(expense.id);
        }
      }
    }

    pending = pending.filter(({ expense, members }) => {
      const allZero = members.every((id) => (balances.get(id) ?? 0) === 0);
      if (allZero) {
        statuses.set(
          expense.id,
          event.kind === "settlement" || repaid.has(expense.id)
            ? "settled"
            : "offset",
        );
      }
      return !allZero;
    });
  }
  return ok(statuses);
}

/** 有任何一位非付款人負擔金額，這筆消費才會產生欠款 */
function createsDebt(payerId: MemberId, shares: Shares): boolean {
  return [...shares].some(
    ([memberId, share]) => memberId !== payerId && share > 0,
  );
}

/** 依記錄時間排序；同一時間時消費排在還款前，再依 id 排序讓結果可重現 */
function byRecordedOrder(a: RecordedEvent, b: RecordedEvent): number {
  if (a.record.createdAt !== b.record.createdAt) {
    return a.record.createdAt.localeCompare(b.record.createdAt);
  }
  if (a.kind !== b.kind) return a.kind === "expense" ? -1 : 1;
  return a.record.id.localeCompare(b.record.id);
}
