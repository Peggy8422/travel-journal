import { useCallback } from "react";

import { useFocusedQuery } from "../../../shared/hooks/useFocusedQuery";
import { useDatabase } from "../../database/DatabaseProvider";
import { loadMapData } from "../services/mapData";

/** 地圖上所有帳本的 pin；畫面取得焦點時重新讀取，新增或修改消費後回來就會更新 */
export function useMapData() {
  const db = useDatabase();
  const load = useCallback(() => loadMapData(db), [db]);
  return useFocusedQuery(load);
}
