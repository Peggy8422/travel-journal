import { useCallback, useEffect, useState } from "react";

import type { MemberRecord } from "../../../domain/ledger";
import { useFocusedQuery } from "../../../shared/hooks/useFocusedQuery";
import {
  useDatabase,
  useLedgerCommandDeps,
} from "../../database/DatabaseProvider";
import {
  ensurePersonalLedger,
  loadPersonalExpenseForEdit,
  loadPersonalSpending,
} from "../services/personalCommands";

/** 個人分頁的所有花費（各月份），data 是 Result */
export function usePersonalSpending() {
  const db = useDatabase();
  const load = useCallback(() => loadPersonalSpending(db), [db]);
  return useFocusedQuery(load);
}

/** 新增個人消費前取得（必要時建立）個人帳本的「我」 */
export function usePersonalSelf(): {
  self: MemberRecord | undefined;
  error: unknown;
} {
  const deps = useLedgerCommandDeps();
  const [state, setState] = useState<{ self?: MemberRecord; error?: unknown }>(
    {},
  );
  useEffect(() => {
    let active = true;
    ensurePersonalLedger(deps).then(
      ({ self }) => active && setState({ self }),
      (error: unknown) => active && setState({ error }),
    );
    return () => {
      active = false;
    };
  }, [deps]);
  return { self: state.self, error: state.error };
}

/**
 * 編輯畫面用的個人消費。data 為 undefined 代表還在讀取；
 * data.found 為 undefined 代表不是個人消費（或已被刪除）。
 */
export function usePersonalExpense(expenseId: string) {
  const db = useDatabase();
  const load = useCallback(
    async () => ({ found: await loadPersonalExpenseForEdit(db, expenseId) }),
    [db, expenseId],
  );
  return useFocusedQuery(load);
}
