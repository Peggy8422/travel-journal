import type { ExpenseFx } from "../../../domain/ledger";
import type { FxRateResolution } from "./resolveFxRate";

/**
 * 把 resolveFxRate 的結果轉成消費要存的匯率資訊。
 * - not-needed（基準幣）→ null
 * - resolved → 臺銀匯率與報價日期
 * - manual-required → undefined，呼叫端要請使用者輸入，再用 manualFx 建立
 */
export function expenseFxFromResolution(
  resolution: FxRateResolution,
): ExpenseFx | null | undefined {
  switch (resolution.status) {
    case "not-needed":
      return null;
    case "resolved":
      return {
        rateToBase: resolution.rate,
        source: resolution.source,
        quoteDate: resolution.quoteDate,
        basis: resolution.basis,
      };
    case "manual-required":
      return undefined;
  }
}

/** 使用者手動輸入或修改過的匯率 */
export function manualFx(rateToBase: string): ExpenseFx {
  return { rateToBase, source: "manual" };
}
