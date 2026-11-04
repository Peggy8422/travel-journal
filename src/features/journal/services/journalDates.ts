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

const DAY_MS = 86_400_000;
const WEEKDAYS = "日一二三四五六";

function utcOf(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

/** 往後（或往前）移幾天，例如 shiftDate("2025-11-30", 1) 是 "2025-12-01" */
export function shiftDate(date: string, days: number): string {
  return new Date(utcOf(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** 第幾天：手帳裡最早一篇是 Day 1 */
export function dayNumber(firstDate: string, date: string): number {
  return Math.round((utcOf(date) - utcOf(firstDate)) / DAY_MS) + 1;
}

/** 星期幾的中文，例如「六」 */
export function weekdayOf(date: string): string {
  return WEEKDAYS[new Date(utcOf(date)).getUTCDay()] ?? "";
}

/** 「11月22日（六）」 */
export function monthDayLabel(date: string): string {
  return `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日（${weekdayOf(date)}）`;
}

/** 日記的標題；沒寫標題時用日期，例如「11月22日」 */
export function entryHeading(entry: {
  readonly title: string;
  readonly date: string;
}): string {
  return (
    entry.title ||
    `${Number(entry.date.slice(5, 7))}月${Number(entry.date.slice(8, 10))}日`
  );
}

/**
 * 寫新日記時預設的日期：接在最後一篇的隔天，但不超過今天（旅行中一天寫好幾篇時停在今天）。
 * 還沒有日記時，綁了帳本就用第一筆消費那天，否則用今天。
 */
export function suggestEntryDate({
  lastDate,
  firstExpenseDate,
  today,
}: {
  readonly lastDate: string | null;
  readonly firstExpenseDate: string | null;
  readonly today: string;
}): string {
  if (lastDate === null) return firstExpenseDate ?? today;
  const next = shiftDate(lastDate, 1);
  // 最後一篇比今天還晚（例如先寫了之後的行程），就照樣接在它後面
  return next <= today || today < lastDate ? next : today;
}
