import { err, ok, type Result } from "../common/result";
import type { LedgerError } from "./errors";
import {
  toExpense,
  toLedger,
  type ExpenseRecord,
  type LedgerRecord,
  type MemberRecord,
} from "./records";
import { computeShares } from "./split";
import type { CategoryTotal } from "./stats";

/** 計算個人花費需要的一本帳本資料 */
export interface LedgerSnapshot {
  readonly ledger: LedgerRecord;
  readonly members: readonly MemberRecord[];
  readonly expenses: readonly ExpenseRecord[];
}

/** 個人分頁上的一筆花費，金額都是「我」實際負擔的基準幣金額 */
export interface PersonalEntry {
  /** personal：在個人分頁新增的，可以在個人分頁編輯；shared：來自分帳帳本，只能回帳本修改 */
  readonly source: "personal" | "shared";
  readonly ledger: LedgerRecord;
  readonly expense: ExpenseRecord;
  readonly myShareMinor: number;
}

/**
 * 收集「我」在各帳本的花費：
 * - 個人帳本的消費整筆都算我的
 * - 分帳帳本只算我負擔的份額（與結餘同一套計算），我沒有參與的消費不列出
 * - 沒有指定「我是誰」的分帳帳本整本略過
 * 已刪除的消費不計入。
 */
export function collectPersonalEntries(
  ledgers: readonly LedgerSnapshot[],
): Result<PersonalEntry[], LedgerError> {
  const entries: PersonalEntry[] = [];
  for (const { ledger, members, expenses } of ledgers) {
    const self = members.find((m) => m.isSelf);
    if (!self) continue;
    const calcLedger = toLedger(ledger, members);

    for (const expense of expenses) {
      if (expense.deletedAt !== null) continue;
      const shares = computeShares(toExpense(expense), calcLedger);
      if (!shares.ok) {
        return err({
          code: "INVALID_EXPENSE",
          expenseId: expense.id,
          cause: shares.error,
        });
      }
      const myShareMinor = shares.value.get(self.id) ?? 0;
      if (myShareMinor <= 0) continue;
      entries.push({
        source: ledger.kind === "personal" ? "personal" : "shared",
        ledger,
        expense,
        myShareMinor,
      });
    }
  }
  return ok(entries);
}

export interface PersonalMonth {
  /** YYYY-MM */
  readonly month: string;
  /** 這個月的花費，依消費時間新的在前 */
  readonly entries: readonly PersonalEntry[];
  readonly totalMinor: number;
  /** 個人分頁新增的部分 */
  readonly personalMinor: number;
  /** 分帳負擔的部分 */
  readonly sharedMinor: number;
  /** 依金額由大到小 */
  readonly categories: readonly CategoryTotal[];
}

/** 某個月（依消費當地的日期）的個人花費彙總 */
export function summarizePersonalMonth(
  entries: readonly PersonalEntry[],
  month: string,
): PersonalMonth {
  const inMonth = entries
    .filter((e) => e.expense.occurredAt.slice(0, 7) === month)
    .sort(
      (a, b) =>
        Date.parse(b.expense.occurredAt) - Date.parse(a.expense.occurredAt) ||
        b.expense.createdAt.localeCompare(a.expense.createdAt),
    );

  let personalMinor = 0;
  let sharedMinor = 0;
  const byCategory = new Map<string | null, number>();
  for (const entry of inMonth) {
    if (entry.source === "personal") personalMinor += entry.myShareMinor;
    else sharedMinor += entry.myShareMinor;
    const category = entry.expense.category;
    byCategory.set(
      category,
      (byCategory.get(category) ?? 0) + entry.myShareMinor,
    );
  }

  return {
    month,
    entries: inMonth,
    totalMinor: personalMinor + sharedMinor,
    personalMinor,
    sharedMinor,
    categories: [...byCategory]
      .map(([category, totalMinor]) => ({ category, totalMinor }))
      .sort(
        (a, b) =>
          b.totalMinor - a.totalMinor ||
          (a.category ?? "").localeCompare(b.category ?? ""),
      ),
  };
}

/** 月份加減，例如 shiftMonth("2026-01", -1) → "2025-12" */
export function shiftMonth(month: string, delta: number): string {
  const year = Number(month.slice(0, 4));
  const index = year * 12 + Number(month.slice(5, 7)) - 1 + delta;
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}
