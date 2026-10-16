import type { BotQuote } from "./types";

/**
 * 找出報價日期 ≤ date 的最新一筆，也就是 date 當天或之前最近一個營業日的報價。
 * 不假設輸入已排序。
 */
export function findQuoteOnOrBefore(
  quotes: readonly BotQuote[],
  date: string,
): BotQuote | undefined {
  let best: BotQuote | undefined;
  for (const quote of quotes) {
    if (
      quote.quoteDate <= date &&
      (!best || quote.quoteDate > best.quoteDate)
    ) {
      best = quote;
    }
  }
  return best;
}
