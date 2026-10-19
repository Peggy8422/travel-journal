const MINUTE_MS = 60 * 1000;

/**
 * 產生帶裝置當下時區的 ISO 8601 字串，例如 2026-10-12T12:00:00+09:00。
 * 消費時間要保留當地時間（出國時就是當地時區），所以不用 toISOString() 的 UTC。
 *
 * @param offsetMinutes 與 UTC 的差距（東區為正），預設取裝置時區
 */
export function toLocalIsoString(
  date: Date,
  offsetMinutes = -date.getTimezoneOffset(),
): string {
  const local = new Date(date.getTime() + offsetMinutes * MINUTE_MS);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${local.toISOString().slice(0, 19)}${sign}${hh}:${mm}`;
}

/** 顯示帶時區字串的當地日期時間，例如 "10/12 12:00"（不換算成裝置時區） */
export function formatLocalDateTime(timestamp: string): string {
  const month = timestamp.slice(5, 7);
  const day = timestamp.slice(8, 10);
  const time = timestamp.slice(11, 16);
  return `${Number(month)}/${Number(day)} ${time}`;
}
