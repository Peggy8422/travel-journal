import {
  expenseMemberIds,
  type ExpenseRecord,
  type MemberId,
} from "../../../domain/ledger";

/** 消費列表的篩選條件；null 代表不篩選 */
export interface ExpenseFilter {
  /** 只看這位成員有參與（付款或分攤）的消費 */
  readonly memberId: MemberId | null;
  /** 只看這個分類；category 為 null 代表「未分類」 */
  readonly category: { readonly category: string | null } | null;
}

export const NO_FILTER: ExpenseFilter = { memberId: null, category: null };

export function isFiltering(filter: ExpenseFilter): boolean {
  return filter.memberId !== null || filter.category !== null;
}

export function filterExpenses(
  expenses: readonly ExpenseRecord[],
  filter: ExpenseFilter,
): ExpenseRecord[] {
  return expenses.filter((expense) => {
    if (
      filter.memberId !== null &&
      !expenseMemberIds(expense).includes(filter.memberId)
    ) {
      return false;
    }
    if (
      filter.category !== null &&
      expense.category !== filter.category.category
    ) {
      return false;
    }
    return true;
  });
}

export interface ExpenseDay {
  /** 消費當地的日期 YYYY-MM-DD */
  readonly date: string;
  /** 0 = 星期日 */
  readonly weekday: number;
  /** 當天合計（基準幣最小單位） */
  readonly totalBaseMinor: number;
  /** 當天的消費，新的在前 */
  readonly expenses: readonly ExpenseRecord[];
}

/**
 * 依消費「當地」的日期分組（與列表顯示的時間一致，在東京記的就算東京的日期），
 * 新的日期在前，同一天內依實際時間點新的在前。
 */
export function groupByLocalDay(
  expenses: readonly ExpenseRecord[],
  baseAmounts: ReadonlyMap<string, number>,
): ExpenseDay[] {
  const byDate = new Map<string, ExpenseRecord[]>();
  for (const expense of expenses) {
    const date = expense.occurredAt.slice(0, 10);
    byDate.set(date, [...(byDate.get(date) ?? []), expense]);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({
      date,
      weekday: new Date(`${date}T00:00:00Z`).getUTCDay(),
      totalBaseMinor: items.reduce(
        (sum, e) => sum + (baseAmounts.get(e.id) ?? 0),
        0,
      ),
      expenses: [...items].sort(
        (a, b) =>
          Date.parse(b.occurredAt) - Date.parse(a.occurredAt) ||
          b.createdAt.localeCompare(a.createdAt),
      ),
    }));
}
