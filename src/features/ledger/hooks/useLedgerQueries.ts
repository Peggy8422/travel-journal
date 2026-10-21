import { useCallback } from "react";

import { useFocusedQuery } from "../../../shared/hooks/useFocusedQuery";
import { useDatabase } from "../../database/DatabaseProvider";
import { loadLedgerOverviews } from "../services/ledgerOverview";
import { loadLedgerStats, loadLedgerSummary } from "../services/ledgerSummary";

/** 所有帳本與摘要，依建立時間由新到舊；畫面取得焦點時重新讀取 */
export function useLedgerList() {
  const db = useDatabase();
  const load = useCallback(() => loadLedgerOverviews(db), [db]);
  return useFocusedQuery(load);
}

/** 帳本的完整資料與結餘；data 是 Result，帳本不存在或資料有誤時為錯誤 */
export function useLedgerSummary(ledgerId: string) {
  const db = useDatabase();
  const load = useCallback(
    () => loadLedgerSummary(db, ledgerId),
    [db, ledgerId],
  );
  return useFocusedQuery(load);
}

/** 帳本的花費統計；data 是 Result */
export function useLedgerStats(ledgerId: string) {
  const db = useDatabase();
  const load = useCallback(() => loadLedgerStats(db, ledgerId), [db, ledgerId]);
  return useFocusedQuery(load);
}
