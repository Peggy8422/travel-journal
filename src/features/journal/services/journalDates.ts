import { toTaipeiDate } from "../../../domain/fx";

const dotted = (date: string) => date.replace(/-/g, ".");

/**
 * 日記的日期範圍，例如「2025.11.21 – 11.24」；同一年省略後面的年份，只有一天時只寫那天。
 * 沒有日記時回傳 null。
 */
export function formatDateRange(
  first: string | null,
  last: string | null,
): string | null {
  if (first === null || last === null) return null;
  if (first === last) return dotted(first);
  const tail = first.slice(0, 4) === last.slice(0, 4) ? last.slice(5) : last;
  return `${dotted(first)} – ${dotted(tail)}`;
}

/** 封面標籤上的小字：日記的日期範圍，還沒有日記時用建立手帳的月份（臺灣時間） */
export function journalCaption(
  createdAt: string,
  first: string | null,
  last: string | null,
): string {
  const range = formatDateRange(first, last);
  if (range !== null) return range;
  const created = toTaipeiDate(createdAt);
  return dotted((created.ok ? created.value : createdAt).slice(0, 7));
}
