import type { GeoPoint } from "../ledger";
import type { MapRegion } from "./types";

export interface RegionOptions {
  /** 四周各留跨度的多少比例，避免標記貼在畫面邊緣 */
  readonly paddingRatio?: number;
  /** 最小跨度（度），只有一個點或所有點很近時不會放大到看不出位置；0.01 度約 1 公里 */
  readonly minDelta?: number;
}

/**
 * 算出能框住所有點的地圖範圍；沒有點時回傳 undefined，由呼叫端決定預設位置。
 * 點分布在換日線兩側時（例如斐濟），改用跨過換日線的較小範圍。
 */
export function regionForPoints(
  points: readonly GeoPoint[],
  { paddingRatio = 0.2, minDelta = 0.01 }: RegionOptions = {},
): MapRegion | undefined {
  if (points.length === 0) return undefined;

  const lats = points.map((p) => p.latitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const lng = longitudeSpan(points.map((p) => p.longitude));

  const scale = 1 + paddingRatio * 2;
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: normalizeLongitude(lng.center),
    latitudeDelta: Math.min(Math.max((maxLat - minLat) * scale, minDelta), 180),
    longitudeDelta: Math.min(Math.max(lng.span * scale, minDelta), 360),
  };
}

/** 經度的中心與跨度；跨過換日線比較小時，改用跨換日線的範圍 */
function longitudeSpan(lngs: readonly number[]): {
  center: number;
  span: number;
} {
  const direct = rangeOf(lngs);
  // Shift western longitudes by 360 so points across the antimeridian become contiguous
  const shifted = rangeOf(lngs.map((l) => (l < 0 ? l + 360 : l)));
  const best =
    shifted.max - shifted.min < direct.max - direct.min ? shifted : direct;
  return { center: (best.min + best.max) / 2, span: best.max - best.min };
}

function rangeOf(values: readonly number[]): { min: number; max: number } {
  return { min: Math.min(...values), max: Math.max(...values) };
}

function normalizeLongitude(lng: number): number {
  return lng > 180 ? lng - 360 : lng;
}
