import { err, ok, type Result } from "../common/result";
import { computeMidRate } from "./midRate";
import type { BotQuote, FxError, MidRate } from "./types";

/**
 * 從臺銀報價選出要使用的中價：
 * 即期買入與賣出都有 → 即期中價；否則現金買入與賣出都有 → 現金中價；都沒有 → 錯誤。
 * 只有單邊報價視為不可用，不拿單邊價格當中價。
 */
export function selectMidRate(quote: BotQuote): Result<MidRate, FxError> {
  if (quote.spotBuy !== undefined && quote.spotSell !== undefined) {
    return withBasis(computeMidRate(quote.spotBuy, quote.spotSell), "spot");
  }
  if (quote.cashBuy !== undefined && quote.cashSell !== undefined) {
    return withBasis(computeMidRate(quote.cashBuy, quote.cashSell), "cash");
  }
  return err({ code: "NO_USABLE_QUOTE", currency: quote.currency });
}

function withBasis(
  result: Result<string, FxError>,
  basis: MidRate["basis"],
): Result<MidRate, FxError> {
  return result.ok ? ok({ rate: result.value, basis }) : result;
}
