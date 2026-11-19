import type { JournalEntryRecord } from "../../../domain/journal";
import { dayNumber } from "./journalDates";

/*
 * 整本手帳的回顧（分享到 IG 的輪播貼文）：封面一張，之後每天一張。
 * 只決定有哪幾天、每天放什麼；卡片長相在 RecapShareCards。
 */

/** IG 輪播最多 20 張，扣掉封面最多放幾天 */
export const RECAP_DAY_LIMIT = 19;

export interface RecapDay {
  readonly date: string;
  /** 這本手帳的第幾天（最早一篇是 Day 1） */
  readonly dayNumber: number;
  /** 這天最早寫的一篇，用它的標題、內文、印章 */
  readonly entry: JournalEntryRecord;
  /** 這天的第一張照片（第一篇沒有照片時往後找）；整天都沒照片時為 null */
  readonly photo: string | null;
}

/** 依日期由舊到新，一天一張；超過 RECAP_DAY_LIMIT 天時只取前面的 */
export function recapDays(
  entries: readonly JournalEntryRecord[],
): readonly RecapDay[] {
  const sorted = [...entries].sort(
    (a, b) =>
      a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  );
  const first = sorted[0]?.date;
  if (first === undefined) return [];
  const days: RecapDay[] = [];
  for (const entry of sorted) {
    const last = days[days.length - 1];
    if (last?.date === entry.date) {
      if (last.photo === null && entry.photos[0] !== undefined) {
        days[days.length - 1] = { ...last, photo: entry.photos[0] };
      }
      continue;
    }
    days.push({
      date: entry.date,
      dayNumber: dayNumber(first, entry.date),
      entry,
      photo: entry.photos[0] ?? null,
    });
  }
  return days.slice(0, RECAP_DAY_LIMIT);
}

export interface RecapStats {
  /** 從第一篇到最後一篇共幾天 */
  readonly days: number;
  readonly entries: number;
  /** 去過幾個地方（同名的算一個） */
  readonly places: number;
}

export function recapStats(entries: readonly JournalEntryRecord[]): RecapStats {
  const dates = entries.map((entry) => entry.date).sort();
  const first = dates[0];
  const last = dates[dates.length - 1];
  return {
    days: first && last ? dayNumber(first, last) : 0,
    entries: entries.length,
    places: new Set(entries.flatMap((e) => e.places.map((p) => p.name))).size,
  };
}

/** 「4 天・4 篇日記・5 個地方」，沒有地點時省略地點 */
export function recapStatsLabel(stats: RecapStats): string {
  return [
    `${stats.days} 天`,
    `${stats.entries} 篇日記`,
    ...(stats.places > 0 ? [`${stats.places} 個地方`] : []),
  ].join("・");
}

/** 貼在 IG 說明欄的文字：手帳名稱、日期範圍、天數與篇數 */
export function recapCaption(
  name: string,
  range: string | null,
  stats: RecapStats,
): string {
  return [name, ...(range ? [range] : []), recapStatsLabel(stats)].join("\n");
}

/**
 * 每天那張上面的 Day 索引籤一次放幾個，太多天時只放目前這天附近的：
 * 回傳要從第幾天開始放，讓目前這天盡量在中間。
 */
export function tabWindowStart(
  count: number,
  index: number,
  size: number,
): number {
  if (count <= size) return 0;
  const start = index - Math.floor(size / 2);
  return Math.max(0, Math.min(start, count - size));
}
