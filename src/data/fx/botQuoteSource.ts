import {
  findQuoteOnOrBefore,
  toTaipeiDate,
  type BotQuote,
  type BotQuoteSource,
} from "../../domain/fx";
import type { CurrencyCode } from "../../domain/ledger";
import { parseBotDailyCsv } from "./botDailyCsvParser";
import type { BotCsvError } from "./botCsvShared";
import { parseBotHistoryCsv } from "./botHistoryCsvParser";

/** 臺銀牌告的 19 個幣別（2026-10-13 牌告 CSV）。不在清單內的幣別不發出請求 */
export const BOT_QUOTED_CURRENCIES: readonly CurrencyCode[] = [
  "USD",
  "HKD",
  "GBP",
  "AUD",
  "CAD",
  "SGD",
  "CHF",
  "JPY",
  "ZAR",
  "SEK",
  "NZD",
  "THB",
  "PHP",
  "IDR",
  "EUR",
  "KRW",
  "VND",
  "MYR",
  "CNY",
];

/** 臺銀 CSV 格式與預期不符。這代表臺銀改了格式，需要更新解析器，應該被記錄下來 */
export class BotCsvFormatError extends Error {
  constructor(readonly detail: BotCsvError) {
    super(`Bank of Taiwan CSV format changed: ${JSON.stringify(detail)}`);
    this.name = "BotCsvFormatError";
  }
}

export interface TodayQuotesDeps {
  readonly fetchDailyCsv: () => Promise<string>;
  readonly now: () => Date;
}

export interface BotQuoteSourceDeps extends TodayQuotesDeps {
  readonly fetchHistoryCsv: (currency: CurrencyCode) => Promise<string>;
}

/**
 * 下載並解析今日牌告。
 * CSV 本身沒有日期，所以用「下載當下的臺灣日期」當報價日期。
 * 已知限制：週末下載時，內容其實是上一個營業日的牌告，但會被標成當天。
 */
export async function loadTodayQuotes(
  deps: TodayQuotesDeps,
): Promise<{ date: string; quotes: BotQuote[] }> {
  const today = taipeiToday(deps.now);
  const csv = await deps.fetchDailyCsv();
  const parsed = parseBotDailyCsv(csv, today);
  if (!parsed.ok) throw new BotCsvFormatError(parsed.error);
  return { date: today, quotes: parsed.value };
}

/**
 * BotQuoteSource 的臺銀實作：
 * - 今天 → 牌告 CSV（一次取得全部幣別）
 * - 過去日期 → 該幣別的近半年歷史 CSV，取當天或之前最近一個營業日
 */
export function createBotQuoteSource(deps: BotQuoteSourceDeps): BotQuoteSource {
  return {
    async fetchQuote(currency, date) {
      if (!BOT_QUOTED_CURRENCIES.includes(currency)) {
        return { kind: "currency-not-quoted" };
      }
      const today = taipeiToday(deps.now);
      if (date > today) {
        throw new RangeError(`Cannot fetch a quote for a future date: ${date}`);
      }
      return date === today
        ? fetchToday(currency, deps)
        : fetchHistorical(currency, date, deps);
    },
  };
}

async function fetchToday(currency: CurrencyCode, deps: TodayQuotesDeps) {
  const { quotes } = await loadTodayQuotes(deps);
  const quote = quotes.find((q) => q.currency === currency);
  return quote
    ? ({ kind: "found", quote } as const)
    : ({ kind: "currency-not-quoted" } as const);
}

async function fetchHistorical(
  currency: CurrencyCode,
  date: string,
  deps: BotQuoteSourceDeps,
) {
  const csv = await deps.fetchHistoryCsv(currency);
  const parsed = parseBotHistoryCsv(csv, currency);
  if (!parsed.ok) throw new BotCsvFormatError(parsed.error);
  const quote = findQuoteOnOrBefore(parsed.value, date);
  return quote
    ? ({ kind: "found", quote } as const)
    : ({ kind: "date-out-of-range" } as const);
}

function taipeiToday(now: () => Date): string {
  const today = toTaipeiDate(now().toISOString());
  if (!today.ok)
    throw new Error(`Unexpected clock value: ${now().toISOString()}`);
  return today.value;
}
