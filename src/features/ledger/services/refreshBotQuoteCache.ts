import type { BotQuoteCache } from "../../../domain/fx";
import {
  BotCsvFormatError,
  loadTodayQuotes,
  type TodayQuotesDeps,
} from "../../../data/fx/botQuoteSource";

export type RefreshBotQuoteCacheResult =
  | {
      readonly status: "refreshed";
      readonly quoteDate: string;
      readonly count: number;
    }
  | { readonly status: "fetch-failed" }
  | { readonly status: "format-changed"; readonly error: BotCsvFormatError }
  | { readonly status: "cache-write-failed"; readonly savedCount: number };

export interface RefreshBotQuoteCacheDeps extends TodayQuotesDeps {
  readonly cache: BotQuoteCache;
}

/**
 * 一次下載今日牌告並快取所有幣別。
 * 用途：App 開啟或回到前景時在背景執行，讓出國後即使離線，
 * 也有「出發前最後一次連線」的匯率可用，不必等到記過該幣別才有快取。
 *
 * 不會 throw：離線是預期中的情況。但 format-changed 代表臺銀改了格式，呼叫端應記錄下來。
 */
export async function refreshBotQuoteCache(
  deps: RefreshBotQuoteCacheDeps,
): Promise<RefreshBotQuoteCacheResult> {
  let loaded: Awaited<ReturnType<typeof loadTodayQuotes>>;
  try {
    loaded = await loadTodayQuotes(deps);
  } catch (error) {
    if (error instanceof BotCsvFormatError)
      return { status: "format-changed", error };
    return { status: "fetch-failed" };
  }

  let savedCount = 0;
  for (const quote of loaded.quotes) {
    try {
      await deps.cache.save(quote);
      savedCount += 1;
    } catch {
      return { status: "cache-write-failed", savedCount };
    }
  }
  return { status: "refreshed", quoteDate: loaded.date, count: savedCount };
}
