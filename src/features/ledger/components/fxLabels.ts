import type { CurrencyCode, ExpenseFx } from "../../../domain/ledger";

/** 臺銀報價的種類 */
export function basisLabel(basis: "spot" | "cash"): string {
  return basis === "spot" ? "即期" : "現金";
}

/** 存起來的匯率說明，例如「1 JPY = 0.2134 TWD · 臺灣銀行 2026-10-12 即期中價」 */
export function describeStoredFx(
  fx: ExpenseFx,
  currency: CurrencyCode,
  baseCurrency: CurrencyCode,
): string {
  const rate = `1 ${currency} = ${fx.rateToBase} ${baseCurrency}`;
  return fx.source === "manual"
    ? `${rate} · 手動輸入`
    : `${rate} · 臺灣銀行 ${fx.quoteDate} ${basisLabel(fx.basis)}中價`;
}
