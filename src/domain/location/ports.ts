import type { GeoPoint } from "../ledger";

/*
 * 取得裝置位置與地名的介面（只有型別，不含任何 I/O）。
 * 放在 domain 層，讓 features 層使用、data 層實作。
 */

export interface DeviceLocator {
  /** 要求前景定位權限；回傳是否取得 */
  requestPermission(): Promise<boolean>;
  /** 目前位置。定位服務關閉、逾時時應 throw，呼叫端會改用最近一次已知位置 */
  currentPosition(): Promise<GeoPoint>;
  /** 最近一次已知位置（可能是幾分鐘前的）；沒有時回傳 null */
  lastKnownPosition(): Promise<GeoPoint | null>;
  /** 座標轉成地名；查不到時回傳 null，離線或服務錯誤時應 throw */
  placeNameAt(point: GeoPoint): Promise<string | null>;
}
