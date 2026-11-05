import type { IllustrationRecord } from "./illustration";
import type { JournalEntryRecord, JournalRecord } from "./records";

/*
 * 手帳資料的讀寫介面（只有型別，不含任何 I/O），data 層實作。
 * 約定和帳本相同：id 與時間戳記由呼叫端產生後傳入；
 * 資料庫錯誤、違反資料庫約束（例如一本帳本綁兩本手帳）會 throw。
 */

export interface JournalRepository {
  insert(journal: JournalRecord): Promise<void>;
  /** 更新 name、ledgerId、cover 與 updatedAt */
  update(journal: JournalRecord): Promise<void>;
  findById(id: string): Promise<JournalRecord | undefined>;
  /** 綁定這本帳本的手帳（最多一本） */
  findByLedger(ledgerId: string): Promise<JournalRecord | undefined>;
  /** 依建立時間由新到舊 */
  list(): Promise<JournalRecord[]>;
  /** 永久刪除手帳，連同日記與日記的照片、地點 */
  delete(id: string): Promise<void>;
}

export interface JournalEntryRepository {
  /** 連同照片、地點、貼紙一起寫入；要和其他寫入一致時請在 transaction 裡使用 */
  insert(entry: JournalEntryRecord): Promise<void>;
  /** 以 id 覆寫整篇日記（包含所屬的手帳），照片、地點、貼紙整批換掉（createdAt 不變） */
  update(entry: JournalEntryRecord): Promise<void>;
  softDelete(id: string, deletedAt: string): Promise<void>;
  restore(id: string, updatedAt: string): Promise<void>;
  findById(id: string): Promise<JournalEntryRecord | undefined>;
  /** 依日期由舊到新，同一天依建立時間；預設排除已刪除的日記 */
  listByJournal(
    journalId: string,
    options?: { readonly includeDeleted?: boolean },
  ): Promise<JournalEntryRecord[]>;
  /** 所有日記（含已刪除的）用到的照片檔名，清理沒人用的照片時用 */
  listPhotoNames(): Promise<string[]>;
}

export interface IllustrationRepository {
  insert(illustration: IllustrationRecord): Promise<void>;
  /** 換掉筆畫與 updatedAt */
  update(illustration: IllustrationRecord): Promise<void>;
  findById(id: string): Promise<IllustrationRecord | undefined>;
  /** 依建立時間由新到舊 */
  list(): Promise<IllustrationRecord[]>;
  /** 永久刪除，貼在日記上的（含已刪除的日記）也一起拿掉 */
  delete(id: string): Promise<void>;
  /** 每張插圖貼在幾篇日記上（不算已刪除的日記）；沒貼的不會出現 */
  useCounts(): Promise<Record<string, number>>;
}
