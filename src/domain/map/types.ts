import type { GeoPoint } from "../ledger";
import type { PlaceKind, PlaceStatus } from "../places";

/** 地圖上的一個點：一筆消費、日記裡記下的一個地點，或一個收藏的地點 */
export type MapPin = ExpenseMapPin | JournalMapPin | PlaceMapPin;

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

/** 日記裡的一個地點；一篇日記記了幾個地點就有幾個 pin */
export interface JournalMapPin {
  readonly kind: "journal";
  /** 日記 id 加上地點的順序，同一篇日記的各個地點不會重複 */
  readonly id: string;
  readonly entryId: string;
  readonly journalId: string;
  /**
   * 跟著哪一本帳本出現在地圖上：綁定的帳本 id；沒綁帳本的手帳由呼叫端給一個共用的 id，
   * 讓篩選帳本的程式不用分開處理
   */
  readonly ledgerId: string;
  /** 日記標題（空白時由呼叫端換成日期） */
  readonly title: string;
  readonly placeName: string;
  readonly point: GeoPoint;
  /** 日記的日期，旅行當地的 YYYY-MM-DD */
  readonly date: string;
}

/** 收藏的一個地點（想去或去過）；沒有日期，不算在路線、不受日期篩選 */
export interface PlaceMapPin {
  readonly kind: "place";
  /** 收藏地點的 id */
  readonly id: string;
  /** 收藏地點不屬於任何帳本，由呼叫端給一個共用的 id，讓篩選帳本的程式不用分開處理 */
  readonly ledgerId: string;
  readonly title: string;
  /** 和 title 一樣是地點名稱，讓標記旁的地名小標籤不用分開處理 */
  readonly placeName: string;
  readonly point: GeoPoint;
  readonly placeKind: PlaceKind;
  readonly status: PlaceStatus;
  readonly city: string;
}

/** 地圖顯示範圍：中心點加上緯度、經度的跨度（度） */
export interface MapRegion {
  readonly latitude: number;
  readonly longitude: number;
  readonly latitudeDelta: number;
  readonly longitudeDelta: number;
}

/** 同一個地點的多個 pin，在地圖上合成一個標記 */
export interface PinGroup<T extends MapPin = MapPin> {
  /** 由座標組成，同一地點每次都一樣，可當 React key */
  readonly key: string;
  readonly point: GeoPoint;
  /** 保持傳入的順序 */
  readonly pins: readonly T[];
}
