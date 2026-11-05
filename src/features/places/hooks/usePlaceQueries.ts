import { useCallback } from "react";

import { useFocusedQuery } from "../../../shared/hooks/useFocusedQuery";
import { useDatabase } from "../../database/DatabaseProvider";
import {
  loadCriteria,
  loadPlace,
  loadPlaceForm,
  loadPlaceList,
} from "../services/placeCommands";

/** 收藏清單：地點、評分項目與最近刪除的 */
export function usePlaceList() {
  const db = useDatabase();
  const load = useCallback(() => loadPlaceList(db), [db]);
  return useFocusedQuery(load);
}

/** 一個地點（地點頁），data 是 Result */
export function usePlace(placeId: string) {
  const db = useDatabase();
  const load = useCallback(() => loadPlace(db, placeId), [db, placeId]);
  return useFocusedQuery(load);
}

/** 新增（placeId 為 null）／編輯地點表單的資料，data 是 Result */
export function usePlaceForm(placeId: string | null) {
  const db = useDatabase();
  const load = useCallback(() => loadPlaceForm(db, placeId), [db, placeId]);
  return useFocusedQuery(load);
}

/** 全部評分項目（含封存的） */
export function useCriteria() {
  const db = useDatabase();
  const load = useCallback(() => loadCriteria(db), [db]);
  return useFocusedQuery(load);
}
