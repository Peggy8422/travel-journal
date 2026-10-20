import {
  EXPENSE_CATEGORIES,
  isExpenseCategory,
  type ExpenseCategory,
} from "../../../domain/ledger";

const CATEGORY_LABELS: Readonly<Record<ExpenseCategory, string>> = {
  food: "餐飲",
  transport: "交通",
  lodging: "住宿",
  shopping: "購物",
  entertainment: "門票娛樂",
  other: "其他",
};

/** 分類代碼轉成顯示名稱；沒有分類顯示「未分類」，清單以外的舊資料直接顯示原文 */
export function categoryLabel(category: string | null): string {
  if (category === null) return "未分類";
  return isExpenseCategory(category) ? CATEGORY_LABELS[category] : category;
}

/** 圖表上「未分類」的 key（分類本身是 null） */
export const UNCATEGORIZED_KEY = "__uncategorized__";

/**
 * 圖表與圖例的排列順序：清單內的分類依清單順序，清單以外的舊分類依名稱排在後面，未分類最後。
 * 用固定順序而不是依金額排，相鄰的顏色才固定，色盲使用者也分得出相鄰的兩段。
 */
export function orderForChart<T extends { readonly category: string | null }>(
  items: readonly T[],
): T[] {
  const rank = (category: string | null) => {
    if (category === null) return EXPENSE_CATEGORIES.length + 1;
    const index = (EXPENSE_CATEGORIES as readonly string[]).indexOf(category);
    return index === -1 ? EXPENSE_CATEGORIES.length : index;
  };
  return [...items].sort(
    (a, b) =>
      rank(a.category) - rank(b.category) ||
      (a.category ?? "").localeCompare(b.category ?? ""),
  );
}

/** 分類的圖表顏色：清單內的分類固定對應一個顏色，其他（未分類、舊分類）用中性灰 */
export function categoryColor(
  category: string | null,
  palette: {
    readonly categorical: readonly string[];
    readonly neutral: string;
  },
): string {
  if (category === null || !isExpenseCategory(category)) return palette.neutral;
  const index = EXPENSE_CATEGORIES.indexOf(category);
  return palette.categorical[index] ?? palette.neutral;
}
