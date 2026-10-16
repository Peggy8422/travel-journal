import type { CurrencyCode } from "../ledger";

/**
 * 臺銀單一幣別在某一天的牌告報價，數值保持十進位字串。
 * 臺銀未提供的欄位（牌告上顯示「-」）為 undefined。
 */
export interface BotQuote {
  readonly currency: CurrencyCode;
  /** 報價所屬日期（臺灣時間），格式 YYYY-MM-DD */
  readonly quoteDate: string;
  readonly cashBuy?: string;
  readonly cashSell?: string;
  readonly spotBuy?: string;
  readonly spotSell?: string;
}

/** 中價是由哪一組報價算出來的 */
export type RateBasis = "spot" | "cash";

export interface MidRate {
  /** 1 單位外幣 = rate 新台幣，十進位字串 */
  readonly rate: string;
  readonly basis: RateBasis;
}

export type FxError =
  | { readonly code: "INVALID_QUOTE_VALUE"; readonly value: string }
  | {
      readonly code: "QUOTE_BUY_ABOVE_SELL";
      readonly buy: string;
      readonly sell: string;
    }
  | { readonly code: "NO_USABLE_QUOTE"; readonly currency: CurrencyCode }
  | { readonly code: "INVALID_TIMESTAMP"; readonly value: string }
  | { readonly code: "INVALID_DATE"; readonly value: string };
