import type { LedgerOverview } from "./ledgerOverview";

/** 書架的年份、月份篩選；null 代表不限 */
export interface ShelfFilter {
  /** YYYY */
  readonly year: string | null;
  /** 1–12 */
  readonly month: number | null;
}

export const NO_SHELF_FILTER: ShelfFilter = { year: null, month: null };

const yearOf = (o: LedgerOverview) => o.tripMonth.slice(0, 4);
const monthOf = (o: LedgerOverview) => Number(o.tripMonth.slice(5, 7));

/** 有帳本的年份，由新到舊 */
export function shelfYears(overviews: readonly LedgerOverview[]): string[] {
  return [...new Set(overviews.map(yearOf))].sort().reverse();
}

/** 選定年份（null 代表所有年份）裡有帳本的月份，由小到大；其他月份在畫面上不能點 */
export function shelfMonths(
  overviews: readonly LedgerOverview[],
  year: string | null,
): number[] {
  const months = overviews
    .filter((o) => year === null || yearOf(o) === year)
    .map(monthOf);
  return [...new Set(months)].sort((a, b) => a - b);
}

export function applyShelfFilter(
  overviews: readonly LedgerOverview[],
  filter: ShelfFilter,
): LedgerOverview[] {
  return overviews.filter(
    (o) =>
      (filter.year === null || yearOf(o) === filter.year) &&
      (filter.month === null || monthOf(o) === filter.month),
  );
}

export interface ShelfGroup {
  /** YYYY-MM */
  readonly month: string;
  readonly overviews: readonly LedgerOverview[];
}

/** 依旅行月份分組，新的月份在前；同一個月裡保留傳入的順序（列表是建立時間由新到舊） */
export function groupShelf(overviews: readonly LedgerOverview[]): ShelfGroup[] {
  const byMonth = new Map<string, LedgerOverview[]>();
  for (const overview of overviews) {
    const group = byMonth.get(overview.tripMonth) ?? [];
    group.push(overview);
    byMonth.set(overview.tripMonth, group);
  }
  return [...byMonth.keys()]
    .sort()
    .reverse()
    .map((month) => ({ month, overviews: byMonth.get(month) ?? [] }));
}

/** 建立後幾天內、還沒記消費的帳本算「新的」 */
export const NEW_LEDGER_DAYS = 3;

/**
 * 剛建立的帳本：建立後 NEW_LEDGER_DAYS 天內，而且還沒記任何消費。書架上會貼 NEW 紙膠帶，
 * 方便建好後回到書架一眼找到；開始記帳之後就不算新的。
 */
export function isNewLedger(overview: LedgerOverview, now: Date): boolean {
  if (overview.kind !== "ok" || overview.expenseCount > 0) return false;
  const age = now.getTime() - Date.parse(overview.ledger.createdAt);
  return age >= 0 && age < NEW_LEDGER_DAYS * 24 * 60 * 60 * 1000;
}
