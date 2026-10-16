import {
  addDays,
  selectMidRate,
  toTaipeiDate,
  type BotQuote,
  type BotQuoteCache,
  type BotQuoteLookup,
  type BotQuoteSource,
  type FxError,
  type MidRate,
} from "../../../domain/fx";
import type { CurrencyCode } from "../../../domain/ledger";
import { err, ok, type Result } from "../../../domain/common/result";

/** 帳本基準幣別固定為新台幣 */
const BASE_CURRENCY: CurrencyCode = "TWD";

/** 離線時，快取報價最多可以比消費日早幾天 */
export const MAX_CACHE_STALENESS_DAYS = 7;

export interface ResolveFxRateDeps {
  readonly source: BotQuoteSource;
  readonly cache: BotQuoteCache;
  readonly now: () => Date;
}

export type ManualReason =
  | "currency-not-quoted"
  | "date-out-of-range"
  | "no-cached-quote"
  | "cached-quote-too-old"
  | "cached-quote-unusable"
  | "cache-read-failed";

export type FxRateResolution =
  | { readonly status: "not-needed" }
  | {
      readonly status: "resolved";
      readonly rate: string;
      readonly basis: MidRate["basis"];
      readonly source: "bot-live" | "bot-cached";
      /** 實際使用的報價日期；遇到非營業日會早於消費日 */
      readonly quoteDate: string;
      /** 快取寫入失敗不影響這次結果，但需要讓呼叫端知道 */
      readonly cacheWriteFailed: boolean;
    }
  | { readonly status: "manual-required"; readonly reason: ManualReason };

export type ResolveFxRateError =
  FxError | { readonly code: "FUTURE_DATE"; readonly date: string };

/**
 * 依「臺銀線上 → 本機快取 → 手動輸入」的順序取得某筆消費的匯率（臺銀中價）。
 * 只有輸入本身不合法（時間格式錯誤、未來日期）才回傳錯誤；
 * 網路或快取的問題都會轉成 manual-required，讓使用者仍能完成記帳。
 */
export async function resolveFxRate(
  currency: CurrencyCode,
  occurredAt: string,
  deps: ResolveFxRateDeps,
): Promise<Result<FxRateResolution, ResolveFxRateError>> {
  if (currency === BASE_CURRENCY) {
    return ok({ status: "not-needed" });
  }

  const date = toTaipeiDate(occurredAt);
  if (!date.ok) return date;
  const today = toTaipeiDate(deps.now().toISOString());
  if (!today.ok) return today;
  if (date.value > today.value) {
    return err({ code: "FUTURE_DATE", date: date.value });
  }

  const live = await tryLive(currency, date.value, deps);
  if (live.kind === "done") {
    return ok(live.resolution);
  }
  const cached = await resolveFromCache(currency, date.value, deps.cache);
  // 臺銀已查不到該日期時，快取也沒有的話，回報真正的原因
  if (
    live.dateOutOfRange &&
    cached.status === "manual-required" &&
    cached.reason === "no-cached-quote"
  ) {
    return ok({ status: "manual-required", reason: "date-out-of-range" });
  }
  return ok(cached);
}

/**
 * done：線上已得出結論（成功，或臺銀確定沒有這個幣別）
 * fallback：線上取不到，改查快取。超出臺銀歷史範圍時，以前快取過的報價仍可能可用
 */
type LiveOutcome =
  | { readonly kind: "done"; readonly resolution: FxRateResolution }
  | { readonly kind: "fallback"; readonly dateOutOfRange?: boolean };

async function tryLive(
  currency: CurrencyCode,
  date: string,
  deps: ResolveFxRateDeps,
): Promise<LiveOutcome> {
  let lookup: BotQuoteLookup;
  try {
    lookup = await deps.source.fetchQuote(currency, date);
  } catch {
    return { kind: "fallback" };
  }

  if (lookup.kind === "currency-not-quoted") {
    return {
      kind: "done",
      resolution: { status: "manual-required", reason: "currency-not-quoted" },
    };
  }
  if (lookup.kind === "date-out-of-range") {
    return { kind: "fallback", dateOutOfRange: true };
  }

  const { quote } = lookup;
  if (quote.currency !== currency || quote.quoteDate > date) {
    // 來源違反約定，視同這次線上取得失敗
    return { kind: "fallback" };
  }
  const mid = selectMidRate(quote);
  if (!mid.ok) return { kind: "fallback" };

  const cacheWriteFailed = await saveQuietly(deps.cache, quote);
  return {
    kind: "done",
    resolution: {
      status: "resolved",
      rate: mid.value.rate,
      basis: mid.value.basis,
      source: "bot-live",
      quoteDate: quote.quoteDate,
      cacheWriteFailed,
    },
  };
}

async function resolveFromCache(
  currency: CurrencyCode,
  date: string,
  cache: BotQuoteCache,
): Promise<FxRateResolution> {
  let cached: BotQuote | undefined;
  try {
    cached = await cache.findLatestOnOrBefore(currency, date);
  } catch {
    return { status: "manual-required", reason: "cache-read-failed" };
  }
  if (!cached || cached.quoteDate > date) {
    return { status: "manual-required", reason: "no-cached-quote" };
  }

  const oldestAccepted = addDays(date, -MAX_CACHE_STALENESS_DAYS);
  if (!oldestAccepted.ok || cached.quoteDate < oldestAccepted.value) {
    return { status: "manual-required", reason: "cached-quote-too-old" };
  }

  const mid = selectMidRate(cached);
  if (!mid.ok) {
    return { status: "manual-required", reason: "cached-quote-unusable" };
  }
  return {
    status: "resolved",
    rate: mid.value.rate,
    basis: mid.value.basis,
    source: "bot-cached",
    quoteDate: cached.quoteDate,
    cacheWriteFailed: false,
  };
}

/** 回傳 true 代表寫入失敗 */
async function saveQuietly(
  cache: BotQuoteCache,
  quote: BotQuote,
): Promise<boolean> {
  try {
    await cache.save(quote);
    return false;
  } catch {
    return true;
  }
}
