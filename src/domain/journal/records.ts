import type { GeoPoint } from "../ledger";
import type { JournalCover } from "./cover";
import type { JournalMood, JournalWeather } from "./stamps";

/*
 * 旅遊手帳的紀錄：一趟旅行一本手帳，裡面按日期寫日記。
 * 時間戳記（createdAt 等）一律是 ISO 8601 UTC 字串。
 */

export interface JournalRecord {
  readonly id: string;
  /** 手帳自己的名稱；綁定帳本時預設帶入帳本名稱，之後兩邊各改各的 */
  readonly name: string;
  /**
   * 綁定的分帳帳本，日記頁會列出那天這本帳本的消費。null 代表沒有綁定。
   * 一本帳本最多綁一本手帳；帳本被刪除時自動變回 null，手帳與日記照樣保留
   */
  readonly ledgerId: string | null;
  readonly cover: JournalCover;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** 日記裡記下的地點，會出現在地球與詳細地圖上 */
export interface JournalPlace {
  readonly name: string;
  readonly location: GeoPoint;
}

/** 一篇日記最多幾張照片；照片會跟著備份檔走，沒有上限的話備份檔會越來越大 */
export const ENTRY_PHOTO_LIMIT = 9;

export interface JournalEntryRecord {
  readonly id: string;
  readonly journalId: string;
  /** 旅行當地的日期 YYYY-MM-DD（使用者自己選的那一天，不換算時區） */
  readonly date: string;
  /** 可以空白，畫面改顯示日期 */
  readonly title: string;
  readonly body: string;
  /** 認不得的代碼（較新版本的 App 才有的）讀回時當作沒選 */
  readonly weather: JournalWeather | null;
  readonly mood: JournalMood | null;
  /** 照片檔名，依顯示順序 */
  readonly photos: readonly string[];
  /** 依顯示順序 */
  readonly places: readonly JournalPlace[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
}

/** 一本手帳的完整資料，用於備份與還原（包含已刪除的日記） */
export interface JournalBackup {
  readonly journal: JournalRecord;
  readonly entries: readonly JournalEntryRecord[];
}
