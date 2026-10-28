import type { GeoPoint } from "../ledger";
import { locationKey } from "./group";
import type { MapPin } from "./types";

/** pin 的當地日期（YYYY-MM-DD），與帳本列表的日期分組一致：在東京記的就算東京的日期 */
export function localDateOf(pin: MapPin): string {
  return pin.occurredAt.slice(0, 10);
}

/** 有 pin 的日期，由舊到新、不重複 */
export function pinDates(pins: readonly MapPin[]): string[] {
  return [...new Set(pins.map(localDateOf))].sort();
}

/**
 * 依實際時間點由早到晚連起各 pin 的路線。
 * 連續待在同一地點（groupByLocation 會合成同一個標記）的只留第一個點；少於兩個點時沒有路線。
 */
export function routeOf(pins: readonly MapPin[]): GeoPoint[] {
  // Array.prototype.sort is stable, so same-time pins keep their given order
  const ordered = [...pins].sort(
    (a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt),
  );
  const route: GeoPoint[] = [];
  let lastKey: string | null = null;
  for (const pin of ordered) {
    const key = locationKey(pin.point);
    if (key !== lastKey) route.push(pin.point);
    lastKey = key;
  }
  return route.length >= 2 ? route : [];
}
