import type { GeoPoint } from "../ledger";

/*
 * 地圖分頁的地球：正射投影（從無限遠看地球，只看得到朝向自己的半球）。
 * 這裡只有座標計算，畫線、手勢、動畫在 features/map。
 */

/** 地球的視角：正中央的經緯度、放大倍率（1 是整顆地球）、地球中心在畫面上的 y（px） */
export interface GlobeView {
  readonly lon: number;
  readonly lat: number;
  readonly k: number;
  readonly cy: number;
}

/** 台灣：地球待機時面向的地方，也是「回到台灣」的目標 */
export const GLOBE_HOME = { lon: 120.97, lat: 23.7 } as const;

/** 放大倍率的上限：再大海岸線就太粗糙了 */
export const GLOBE_MAX_ZOOM = 6;

/** 拖曳時可以轉到的緯度範圍，避免把地球翻過極點 */
export const GLOBE_LAT_RANGE = { min: -60, max: 75 } as const;

const D2R = Math.PI / 180;

/** 投影參數：中心經緯度的 sin、cos 先算好，畫一整顆地球時每個點都會用到 */
export interface GlobeProjection {
  readonly lon0: number;
  readonly sinLon0: number;
  readonly cosLon0: number;
  readonly sinLat0: number;
  readonly cosLat0: number;
  /** 地球在畫面上的半徑（px） */
  readonly scale: number;
  readonly cx: number;
  readonly cy: number;
}

/** radius 是放大倍率 1 時地球在畫面上的半徑，cx 是地球中心的 x */
export function globeProjection(
  view: GlobeView,
  { cx, radius }: { readonly cx: number; readonly radius: number },
): GlobeProjection {
  const lat0 = view.lat * D2R;
  const lon0 = view.lon * D2R;
  return {
    lon0: view.lon,
    sinLon0: Math.sin(lon0),
    cosLon0: Math.cos(lon0),
    sinLat0: Math.sin(lat0),
    cosLat0: Math.cos(lat0),
    scale: radius * view.k,
    cx,
    cy: view.cy,
  };
}

/**
 * 經緯度轉成觀看座標（單位圓）：x 向右、y 向上、z 朝向觀看者。
 * z > 0 是地球正面看得到的點，z <= 0 在背面。
 */
export function orthographic(
  p: GlobeProjection,
  lon: number,
  lat: number,
): [x: number, y: number, z: number] {
  const l = (lon - p.lon0) * D2R;
  const phi = lat * D2R;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const cosL = Math.cos(l);
  return [
    cosPhi * Math.sin(l),
    p.cosLat0 * sinPhi - p.sinLat0 * cosPhi * cosL,
    p.sinLat0 * sinPhi + p.cosLat0 * cosPhi * cosL,
  ];
}

/**
 * 同 orthographic，但輸入是地球上的單位向量（X 朝經度 0、Y 朝東經 90、Z 朝北極）。
 * 海岸線的向量可以先算好，每一格只剩乘法，不用再算三角函數。
 */
export function orthographicVector(
  p: GlobeProjection,
  x: number,
  y: number,
  z: number,
): [x: number, y: number, z: number] {
  // Rotate the view longitude to the front, then tilt by the view latitude
  const east = y * p.cosLon0 - x * p.sinLon0;
  const front = x * p.cosLon0 + y * p.sinLon0;
  return [
    east,
    p.cosLat0 * z - p.sinLat0 * front,
    p.sinLat0 * z + p.cosLat0 * front,
  ];
}

/** 經緯度轉成地球上的單位向量（給 orthographicVector） */
export function sphereVector(
  lon: number,
  lat: number,
): [x: number, y: number, z: number] {
  const phi = lat * D2R;
  const lambda = lon * D2R;
  return [
    Math.cos(phi) * Math.cos(lambda),
    Math.cos(phi) * Math.sin(lambda),
    Math.sin(phi),
  ];
}

/** 觀看座標轉成畫面座標（px，y 向下） */
export function toScreen(
  p: GlobeProjection,
  x: number,
  y: number,
): { x: number; y: number } {
  return { x: p.cx + p.scale * x, y: p.cy - p.scale * y };
}

/**
 * 讓一組地點都看得到的視角：轉到它們在球面上的中心，
 * 放大到離中心最遠的點落在 spanPx 附近（最多放大 GLOBE_MAX_ZOOM 倍）。
 * 沒有地點時回傳 null。
 */
export function frameForPoints(
  points: readonly GeoPoint[],
  radius: number,
  spanPx = 96,
): { lon: number; lat: number; k: number } | null {
  if (points.length === 0) return null;
  const vectors = points.map((p) => sphereVector(p.longitude, p.latitude));
  const sum = vectors.reduce(
    (acc, v) => [acc[0] + v[0], acc[1] + v[1], acc[2] + v[2]],
    [0, 0, 0],
  );
  // Points spread evenly around the globe cancel out; any centre works then
  const norm = Math.hypot(sum[0], sum[1], sum[2]) || 1;
  const center = sum.map((c) => c / norm);
  const spread = Math.max(
    ...vectors.map((v) =>
      Math.acos(
        Math.max(
          -1,
          Math.min(1, v[0] * center[0] + v[1] * center[1] + v[2] * center[2]),
        ),
      ),
    ),
  );
  const visibleSpread = Math.max(Math.sin(Math.min(spread, Math.PI / 2)), 1e-3);
  return {
    lon: Math.atan2(center[1], center[0]) / D2R,
    lat: Math.atan2(center[2], Math.hypot(center[0], center[1])) / D2R,
    k: Math.max(1, Math.min(GLOBE_MAX_ZOOM, spanPx / (radius * visibleSpread))),
  };
}

/**
 * 往目標視角靠近一步（指數緩動，大約 0.7 秒到位）；經度走比較近的那一邊。
 * 差距小到看不出來時直接對齊目標，arrived 為 true。
 */
export function approachView(
  view: GlobeView,
  target: GlobeView,
  dtSeconds: number,
): { view: GlobeView; arrived: boolean } {
  const a = 1 - Math.exp(-dtSeconds * 4.2);
  const dLon = wrapLongitude(target.lon - view.lon);
  const next = {
    lon: wrapLongitude(view.lon + dLon * a),
    lat: view.lat + (target.lat - view.lat) * a,
    k: view.k + (target.k - view.k) * a,
    cy: view.cy + (target.cy - view.cy) * a,
  };
  const arrived =
    Math.abs(wrapLongitude(target.lon - next.lon)) < 0.05 &&
    Math.abs(target.lat - next.lat) < 0.05 &&
    Math.abs(target.k - next.k) < 0.004 &&
    Math.abs(target.cy - next.cy) < 0.4;
  return arrived
    ? { view: { ...target, lon: wrapLongitude(target.lon) }, arrived }
    : { view: next, arrived };
}

/** 經度換算到 [-180, 180) */
export function wrapLongitude(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}
