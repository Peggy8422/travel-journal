import { useCallback } from "react";

import { useFocusedQuery } from "../../../shared/hooks/useFocusedQuery";
import { useDatabase } from "../../database/DatabaseProvider";
import { toLocalIsoString } from "../../ledger/services/localTimestamp";
import {
  loadDeletedEntries,
  loadEntry,
  loadEntryForm,
} from "../services/entryCommands";
import {
  loadIllustration,
  loadIllustrationLibrary,
} from "../services/illustrationCommands";
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

/** 一篇日記（日記頁），data 是 Result；刪除的日記讀不到 */
export function useEntry(entryId: string) {
  const db = useDatabase();
  const load = useCallback(() => loadEntry(db, entryId), [db, entryId]);
  return useFocusedQuery(load);
}

/**
 * 寫日記／編輯日記表單的資料，data 是 Result。entryId 為 null 時是寫新日記，
 * 預設日期用手機上的今天推算。
 */
export function useEntryForm(journalId: string, entryId: string | null) {
  const db = useDatabase();
  const load = useCallback(
    () =>
      loadEntryForm(
        db,
        journalId,
        entryId,
        toLocalIsoString(new Date()).slice(0, 10),
      ),
    [db, journalId, entryId],
  );
  return useFocusedQuery(load);
}

/** 一本手帳裡刪除的日記，最近刪除的在前 */
export function useDeletedEntries(journalId: string) {
  const db = useDatabase();
  const load = useCallback(
    () => loadDeletedEntries(db, journalId),
    [db, journalId],
  );
  return useFocusedQuery(load);
}

/** 「我的插圖」：所有插圖與各貼在幾篇日記上 */
export function useIllustrationLibrary() {
  const db = useDatabase();
  const load = useCallback(() => loadIllustrationLibrary(db), [db]);
  return useFocusedQuery(load);
}

/** 一張插圖（改畫用），data 是 Result */
export function useIllustration(illustrationId: string) {
  const db = useDatabase();
  const load = useCallback(
    () => loadIllustration(db, illustrationId),
    [db, illustrationId],
  );
  return useFocusedQuery(load);
}
