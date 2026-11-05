import type { GeoPoint } from "../ledger";
import type { MapRegion } from "../map";

/*
 * 取得裝置位置與地名的介面（只有型別，不含任何 I/O）。
 * 放在 domain 層，讓 features 層使用、data 層實作。
 */

export interface DeviceLocator {
  /** 要求前景定位權限；回傳是否取得 */
  requestPermission(): Promise<boolean>;
  /** 是否已經有前景定位權限；只查詢，不會跳出權限詢問 */
  hasPermission(): Promise<boolean>;
  /** 目前位置。定位服務關閉、逾時時應 throw，呼叫端會改用最近一次已知位置 */
  currentPosition(): Promise<GeoPoint>;
  /** 最近一次已知位置（可能是幾分鐘前的）；沒有時回傳 null */
  lastKnownPosition(): Promise<GeoPoint | null>;
  /** 座標轉成地名；查不到時回傳 null，離線或服務錯誤時應 throw */
  placeNameAt(point: GeoPoint): Promise<string | null>;
}

/** 搜尋到的一個地點 */
export interface FoundPlace {
  readonly name: string;
  /** 簡短地址；和名稱一樣或沒有時為 null */
  readonly address: string | null;
  readonly location: GeoPoint;
}

/** 用關鍵字找地點（店名、景點、地址） */
export interface PlaceSearch {
  /**
   * near 是地圖目前看的範圍，附近的地點排前面。
   * 找不到時回傳空陣列；離線或服務錯誤時應 throw。
   */
  search(query: string, near: MapRegion | null): Promise<readonly FoundPlace[]>;
}
