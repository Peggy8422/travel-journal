import type { GeoPoint } from "../ledger";

/** 地圖上的一個點。之後旅行日誌的地點會以新的 kind 加進來 */
export type MapPin = ExpenseMapPin;

export interface ExpenseMapPin {
  readonly kind: "expense";
  /** 消費 id */
  readonly id: string;
  readonly ledgerId: string;
  readonly title: string;
  /** 顯示在標題下方的說明（例如金額、帳本名稱），由呼叫端組好 */
  readonly subtitle: string | null;
  readonly point: GeoPoint;
  /** 帶時區的 ISO 8601 時間 */
  readonly occurredAt: string;
}

/** 地圖顯示範圍：中心點加上緯度、經度的跨度（度） */
export interface MapRegion {
  readonly latitude: number;
  readonly longitude: number;
  readonly latitudeDelta: number;
  readonly longitudeDelta: number;
}

/** 同一個地點的多個 pin，在地圖上合成一個標記 */
export interface PinGroup {
  /** 由座標組成，同一地點每次都一樣，可當 React key */
  readonly key: string;
  readonly point: GeoPoint;
  /** 保持傳入的順序 */
  readonly pins: readonly MapPin[];
}
