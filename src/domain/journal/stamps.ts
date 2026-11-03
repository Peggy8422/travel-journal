/**
 * 日記的天氣、心情小印章代碼，存在 journal_entries 的 weather、mood 欄位。
 * 顯示名稱與圖案在畫面層。只能新增代碼，不要改名或刪除，否則舊日記的印章會不見。
 */
export const JOURNAL_WEATHERS = [
  "sunny",
  "cloudy",
  "rain",
  "snow",
  "windy",
] as const;

export const JOURNAL_MOODS = [
  "happy",
  "excited",
  "relaxed",
  "tired",
  "moved",
] as const;

export type JournalWeather = (typeof JOURNAL_WEATHERS)[number];
export type JournalMood = (typeof JOURNAL_MOODS)[number];

export function isJournalWeather(value: unknown): value is JournalWeather {
  return (JOURNAL_WEATHERS as readonly unknown[]).includes(value);
}

export function isJournalMood(value: unknown): value is JournalMood {
  return (JOURNAL_MOODS as readonly unknown[]).includes(value);
}
