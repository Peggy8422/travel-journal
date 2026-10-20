/**
 * 消費分類的代碼，存在 expenses.category。顯示名稱在畫面層（features/ledger/components/categories.ts）。
 * 只能新增代碼，不要改名或刪除已使用的代碼，否則舊消費會變成清單以外的分類。
 */
export const EXPENSE_CATEGORIES = [
  "food",
  "transport",
  "lodging",
  "shopping",
  "entertainment",
  "other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export function isExpenseCategory(value: string): value is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}
