import type { CurrencyCode } from "../ledger";
import type { BotQuote } from "./types";

/*
 * 取得與保存臺銀報價的介面（只有型別，不含任何 I/O）。
 * 放在 domain 層，讓 features 層使用、data 層實作，兩者都只依賴 domain，
 * 避免 data 層反過來 import features 層。
 */

export type BotQuoteLookup =
  | { readonly kind: "found"; readonly quote: BotQuote }
  | { readonly kind: "currency-not-quoted" }
  | { readonly kind: "date-out-of-range" };

export interface BotQuoteSource {
  /**
   * 回傳該幣別在 date（臺灣時間）當天或之前、最近一個營業日的報價。
   * 網路錯誤、逾時、回應格式不符、暫不支援該日期時應 throw，呼叫端會改查快取。
   */
  fetchQuote(currency: CurrencyCode, date: string): Promise<BotQuoteLookup>;
}

export interface BotQuoteCache {
  /** 回傳報價日期 ≤ date 的最新一筆，沒有則回傳 undefined */
  findLatestOnOrBefore(
    currency: CurrencyCode,
    date: string,
  ): Promise<BotQuote | undefined>;
  /** 同幣別、同報價日期的資料直接覆蓋（臺銀同一天會多次掛牌，保留最新一次） */
  save(quote: BotQuote): Promise<void>;
}
