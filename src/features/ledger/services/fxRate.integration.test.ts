import type { BotQuote, BotQuoteCache } from "../../../domain/fx";
import {
  FIXTURE_NOW,
  realBotDailyCsv,
  realBotUsdHistoryCsv,
} from "../../../data/fx/__fixtures__/botFixtures";
import { createBotQuoteSource } from "../../../data/fx/botQuoteSource";
import { unwrap } from "../../../domain/ledger/testFixtures";
import { refreshBotQuoteCache } from "./refreshBotQuoteCache";
import { resolveFxRate } from "./resolveFxRate";

/** 用記憶體模擬快取，行為符合 BotQuoteCache 的約定（同幣別同日期覆蓋） */
function memoryCache(): BotQuoteCache {
  const store = new Map<string, BotQuote>();
  return {
    findLatestOnOrBefore: async (currency, date) =>
      [...store.values()]
        .filter((q) => q.currency === currency && q.quoteDate <= date)
        .sort((a, b) => b.quoteDate.localeCompare(a.quoteDate))[0],
    save: async (quote) => {
      store.set(`${quote.currency}:${quote.quoteDate}`, quote);
    },
  };
}

const OFFLINE = async (): Promise<string> => {
  throw new Error("offline");
};
const onlineHistory = async () => realBotUsdHistoryCsv;

describe("Bank of Taiwan rate flow (real CSV, fake network)", () => {
  it("resolves a USD expense today from the live CSV", async () => {
    const source = createBotQuoteSource({
      fetchDailyCsv: async () => realBotDailyCsv,
      fetchHistoryCsv: onlineHistory,
      now: () => FIXTURE_NOW,
    });
    const result = unwrap(
      await resolveFxRate("USD", "2026-10-13T12:00:00+08:00", {
        source,
        cache: memoryCache(),
        now: () => FIXTURE_NOW,
      }),
    );
    expect(result).toMatchObject({
      status: "resolved",
      rate: "32.08",
      basis: "spot",
      source: "bot-live",
    });
  });

  it("after a refresh while online, resolves a KRW expense offline the next day from the cache", async () => {
    const cache = memoryCache();
    await refreshBotQuoteCache({
      fetchDailyCsv: async () => realBotDailyCsv,
      cache,
      now: () => FIXTURE_NOW,
    });

    const nextDay = new Date("2026-10-14T04:00:00Z");
    const offlineSource = createBotQuoteSource({
      fetchDailyCsv: OFFLINE,
      fetchHistoryCsv: OFFLINE,
      now: () => nextDay,
    });
    const result = unwrap(
      await resolveFxRate("KRW", "2026-10-14T19:30:00+09:00", {
        source: offlineSource,
        cache,
        now: () => nextDay,
      }),
    );
    expect(result).toMatchObject({
      status: "resolved",
      rate: "0.02414",
      basis: "cash",
      source: "bot-cached",
      quoteDate: "2026-10-13",
    });
  });

  it("backfills a past holiday online from the history CSV and caches the result", async () => {
    const cache = memoryCache();
    const later = new Date("2026-10-16T04:00:00Z");
    const source = createBotQuoteSource({
      fetchDailyCsv: OFFLINE,
      fetchHistoryCsv: onlineHistory,
      now: () => later,
    });

    // 國慶日在東京的晚餐 → 臺灣 10/10 → 前一個營業日 10/08
    const result = unwrap(
      await resolveFxRate("USD", "2026-10-10T20:00:00+09:00", {
        source,
        cache,
        now: () => later,
      }),
    );

    expect(result).toMatchObject({
      status: "resolved",
      rate: "31.9",
      source: "bot-live",
      quoteDate: "2026-10-08",
    });
    expect(await cache.findLatestOnOrBefore("USD", "2026-10-10")).toMatchObject(
      { quoteDate: "2026-10-08" },
    );
  });

  it("backfills offline from a quote cached by an earlier refresh", async () => {
    const cache = memoryCache();
    await refreshBotQuoteCache({
      fetchDailyCsv: async () => realBotDailyCsv,
      cache,
      now: () => FIXTURE_NOW,
    });

    const later = new Date("2026-10-16T04:00:00Z");
    const source = createBotQuoteSource({
      fetchDailyCsv: OFFLINE,
      fetchHistoryCsv: OFFLINE,
      now: () => later,
    });
    const result = unwrap(
      await resolveFxRate("JPY", "2026-10-13T20:00:00+09:00", {
        source,
        cache,
        now: () => later,
      }),
    );

    expect(result).toMatchObject({
      status: "resolved",
      source: "bot-cached",
      quoteDate: "2026-10-13",
    });
  });

  it("asks for manual input when backfilling offline a date that was never cached", async () => {
    const later = new Date("2026-10-16T04:00:00Z");
    const source = createBotQuoteSource({
      fetchDailyCsv: OFFLINE,
      fetchHistoryCsv: OFFLINE,
      now: () => later,
    });
    const result = unwrap(
      await resolveFxRate("USD", "2026-10-13T20:00:00+09:00", {
        source,
        cache: memoryCache(),
        now: () => later,
      }),
    );
    expect(result).toEqual({
      status: "manual-required",
      reason: "no-cached-quote",
    });
  });
});
