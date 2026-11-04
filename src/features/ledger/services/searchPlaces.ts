import { err, ok, type Result } from "../../../domain/common/result";
import type { FoundPlace, PlaceSearch } from "../../../domain/location";
import type { MapRegion } from "../../../domain/map";

export type PlaceSearchError = { readonly code: "PLACE_SEARCH_FAILED" };

/** 清單最多列幾個地點；Apple 地圖依相關程度排序，後面的通常用不到 */
export const PLACE_SEARCH_LIMIT = 15;

/**
 * 選擇地點畫面的搜尋：空白關鍵字不查，離線或服務錯誤改回傳錯誤，不會 throw。
 */
export async function searchPlaces(
  search: PlaceSearch,
  query: string,
  near: MapRegion | null,
): Promise<Result<readonly FoundPlace[], PlaceSearchError>> {
  const keyword = query.trim();
  if (keyword === "") return ok([]);
  try {
    const found = await search.search(keyword, near);
    return ok(found.slice(0, PLACE_SEARCH_LIMIT));
  } catch {
    return err({ code: "PLACE_SEARCH_FAILED" });
  }
}
