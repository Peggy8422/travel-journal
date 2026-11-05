import type { RatingCriterionRecord, SavedPlaceRecord } from "./records";

/*
 * 收藏地點的讀寫介面（只有型別，不含任何 I/O），data 層實作。
 * 約定和帳本相同：id 與時間戳記由呼叫端產生後傳入；資料庫錯誤會 throw。
 */

export interface SavedPlaceRepository {
  /** 連同照片、分數一起寫入；要和其他寫入一致時請在 transaction 裡使用 */
  insert(place: SavedPlaceRecord): Promise<void>;
  /** 以 id 覆寫整個地點，照片、分數整批換掉（createdAt、deletedAt 不變） */
  update(place: SavedPlaceRecord): Promise<void>;
  softDelete(id: string, deletedAt: string): Promise<void>;
  restore(id: string, updatedAt: string): Promise<void>;
  findById(id: string): Promise<SavedPlaceRecord | undefined>;
  /** 依建立時間由新到舊；預設排除已刪除的 */
  list(options?: {
    readonly includeDeleted?: boolean;
  }): Promise<SavedPlaceRecord[]>;
  /** 所有地點（含已刪除的）用到的照片檔名，清理沒人用的照片時用 */
  listPhotoNames(): Promise<string[]>;
}

export interface RatingCriterionRepository {
  insert(criterion: RatingCriterionRecord): Promise<void>;
  /** 更新 label、sortOrder、archivedAt 與 updatedAt */
  update(criterion: RatingCriterionRecord): Promise<void>;
  findById(id: string): Promise<RatingCriterionRecord | undefined>;
  /** 全部（含封存的），依 sortOrder */
  list(): Promise<RatingCriterionRecord[]>;
}
