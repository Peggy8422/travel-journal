import { useCallback } from "react";

import { useFocusedQuery } from "../../../shared/hooks/useFocusedQuery";
import { useDatabase } from "../../database/DatabaseProvider";
import {
  loadJournal,
  loadJournalShelf,
  loadLedgerChoices,
} from "../services/journalCommands";

/** 所有手帳的摘要（書架、個人分頁） */
export function useJournalShelf() {
  const db = useDatabase();
  const load = useCallback(() => loadJournalShelf(db), [db]);
  return useFocusedQuery(load);
}

/** 一本手帳與它的日記，data 是 Result */
export function useJournal(journalId: string) {
  const db = useDatabase();
  const load = useCallback(() => loadJournal(db, journalId), [db, journalId]);
  return useFocusedQuery(load);
}

/** 可以綁定的帳本；selfJournalId 是正在修改的手帳（它自己綁的帳本仍然可以選） */
export function useLedgerChoices(selfJournalId: string | null) {
  const db = useDatabase();
  const load = useCallback(
    () => loadLedgerChoices(db, selfJournalId),
    [db, selfJournalId],
  );
  return useFocusedQuery(load);
}
