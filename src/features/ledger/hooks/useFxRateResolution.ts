import { useEffect, useMemo, useState } from "react";

import type { Result } from "../../../domain/common/result";
import type { CurrencyCode } from "../../../domain/ledger";
import { useDatabase } from "../../database/DatabaseProvider";
import { createBotQuoteDeps } from "../services/botQuoteDeps";
import {
  resolveFxRate,
  type FxRateResolution,
  type ResolveFxRateDeps,
  type ResolveFxRateError,
} from "../services/resolveFxRate";

export type FxRateState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | {
      readonly status: "done";
      readonly result: Result<FxRateResolution, ResolveFxRateError>;
    };

/**
 * 依「臺銀線上 → 本機快取 → 手動」取得某幣別在某時間的匯率；參數變動時重新查詢。
 * enabled 為 false 時不查詢（例如編輯時沿用原本存的匯率），回傳 idle。
 */
export function useFxRateResolution(
  currency: CurrencyCode,
  occurredAt: string,
  enabled = true,
): FxRateState {
  const db = useDatabase();
  const deps = useMemo<ResolveFxRateDeps>(() => createBotQuoteDeps(db), [db]);

  const key = `${currency}@${occurredAt}`;
  const [state, setState] = useState<{
    key: string;
    result?: FxRateState & { status: "done" };
  }>({ key });

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    resolveFxRate(currency, occurredAt, deps).then((result) => {
      if (active) setState({ key, result: { status: "done", result } });
    });
    return () => {
      active = false;
    };
  }, [currency, occurredAt, deps, key, enabled]);

  if (!enabled) return { status: "idle" };
  // 換幣別後、新結果回來前，不顯示上一個幣別的匯率
  return state.key === key && state.result
    ? state.result
    : { status: "loading" };
}
