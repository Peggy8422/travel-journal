import { err, ok, type Result } from "../common/result";
import type { GeoPoint } from "../ledger";

/*
 * 收藏的地點：想去的、去過的餐廳與景點，一份清單、依城市分組，不屬於任何手帳或帳本。
 * 去過的地點可以用自己訂的評分項目打分數。
 * 時間戳記（createdAt 等）一律是 ISO 8601 UTC 字串。
 */

/**
 * 地點的類型代碼，中文名稱在畫面層。只能新增代碼，不要改名或刪除，
 * 否則舊資料的類型會跑掉；認不得的代碼讀回時當作 other。
 */
export const PLACE_KINDS = [
  "restaurant",
  "cafe",
  "sweets",
  "bar",
  "sight",
  "shopping",
  "stay",
  "other",
] as const;

export type PlaceKind = (typeof PLACE_KINDS)[number];

/** want 是想去、visited 是去過；認不得的狀態讀回時當作想去 */
export const PLACE_STATUSES = ["want", "visited"] as const;

export type PlaceStatus = (typeof PLACE_STATUSES)[number];

/** 一個評分項目的分數，1～5 */
export const RATING_SCORE = { min: 1, max: 5 } as const;

export interface PlaceRating {
  readonly criterionId: string;
  readonly score: number;
}

/** 一個地點最多幾張照片；照片會跟著備份檔走 */
export const PLACE_PHOTO_LIMIT = 6;

export interface SavedPlaceRecord {
  readonly id: string;
  readonly name: string;
  readonly location: GeoPoint;
  /** 依城市分組用；收藏時用反查地名帶入，可以自己改，查不到時是空字串 */
  readonly city: string;
  readonly kind: PlaceKind;
  readonly status: PlaceStatus;
  /** 心得或想去的理由 */
  readonly note: string;
  /**
   * 有打分數的評分項目（沒打的項目不在裡面），依評分項目的順序。
   * 改回「想去」時照樣保留，畫面只在去過時顯示
   */
  readonly ratings: readonly PlaceRating[];
  /** 「還想再去」：不算總分，自己標記會不會再訪 */
  readonly revisit: boolean;
  /** 照片檔名，依顯示順序 */
  readonly photos: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
}

/** 同時使用中（沒封存）的評分項目最多幾個 */
export const ACTIVE_CRITERIA_LIMIT = 5;

/**
 * 使用者自己訂的評分項目（預設「好吃、氣氛、CP值」，由 migration 建立）。
 * 不能刪除、只能封存：地點的分數會指向它，刪掉的話舊分數就沒有意義了。
 */
export interface RatingCriterionRecord {
  readonly id: string;
  readonly label: string;
  /** 顯示順序，小的在前 */
  readonly sortOrder: number;
  /** 封存的時間；封存的項目不再出現在評分表單，但舊分數照樣顯示 */
  readonly archivedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function isPlaceKind(value: unknown): value is PlaceKind {
  return (PLACE_KINDS as readonly unknown[]).includes(value);
}

export function isPlaceStatus(value: unknown): value is PlaceStatus {
  return (PLACE_STATUSES as readonly unknown[]).includes(value);
}

/**
 * 從資料庫或備份讀回一個分數。評分項目 id 不是字串、分數不是有限數字就拒絕；
 * 分數四捨五入並夾回 1～5。
 */
export function parseRating(value: unknown): Result<PlaceRating, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return err("not an object");
  }
  const { criterionId, score } = value as Record<string, unknown>;
  if (typeof criterionId !== "string") return err("invalid criterionId");
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return err("invalid score");
  }
  return ok({
    criterionId,
    score: Math.min(
      RATING_SCORE.max,
      Math.max(RATING_SCORE.min, Math.round(score)),
    ),
  });
}
