import type { MapPin, PinGroup } from "./types";

/** 座標四捨五入到小數第 4 位（約 10 公尺）視為同一地點，同一家店的多筆消費會合在一起 */
const GROUP_DECIMALS = 4;

/**
 * 把同一地點的 pin 合成一組，避免標記疊在一起點不到。
 * 組的順序依各組第一個 pin 出現的順序，組的座標用該組第一個 pin 的座標。
 * 剛好落在四捨五入邊界兩側的兩個點會分成兩組，地圖上仍然分得開，可以接受。
 */
export function groupByLocation(pins: readonly MapPin[]): PinGroup[] {
  const groups = new Map<string, { point: MapPin["point"]; pins: MapPin[] }>();
  for (const pin of pins) {
    const key = locationKey(pin.point);
    const group = groups.get(key);
    if (group) {
      group.pins.push(pin);
    } else {
      groups.set(key, { point: pin.point, pins: [pin] });
    }
  }
  return [...groups].map(([key, group]) => ({ key, ...group }));
}

function locationKey(point: MapPin["point"]): string {
  return `${round(point.latitude)},${round(point.longitude)}`;
}

function round(value: number): string {
  // Avoid "-0.0000" so both sides of zero share a key
  const fixed = value.toFixed(GROUP_DECIMALS);
  return Number(fixed) === 0 ? (0).toFixed(GROUP_DECIMALS) : fixed;
}
