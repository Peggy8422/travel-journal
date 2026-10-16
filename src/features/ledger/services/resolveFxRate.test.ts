import type {
  BotQuote,
  BotQuoteCache,
  BotQuoteLookup,
  BotQuoteSource,
} from "../../../domain/fx";
import { unwrap, unwrapErr } from "../../../domain/ledger/testFixtures";
import { resolveFxRate, type ResolveFxRateDeps } from "./resolveFxRate";

const usdQuote = (quoteDate: string): BotQuote => ({
  currency: "USD",
  quoteDate,
  spotBuy: "32.3",
  spotSell: "32.4",
});

function fakeSource(
  result: BotQuoteLookup | Error,
): BotQuoteSource & { calls: [string, string][] } {
  const calls: [string, string][] = [];
  return {
    calls,
    fetchQuote: async (currency, date) => {
      calls.push([currency, date]);
      if (result instanceof Error) throw result;
      return result;
    },
  };
}

function fakeCache(
  stored: BotQuote[] = [],
  options: { failRead?: boolean; failWrite?: boolean } = {},
) {
  const saved: BotQuote[] = [];
  const cache: BotQuoteCache = {
    findLatestOnOrBefore: async (currency, date) => {
      if (options.failRead) throw new Error("db read failed");
      return stored
        .filter((q) => q.currency === currency && q.quoteDate <= date)
        .sort((a, b) => b.quoteDate.localeCompare(a.quoteDate))[0];
    },
    save: async (quote) => {
      if (options.failWrite) throw new Error("db write failed");
      saved.push(quote);
    },
  };
  return { cache, saved };
}

const NOW = new Date("2026-10-13T04:00:00Z"); // 臺灣時間 10/13 12:00
const OFFLINE = new Error("network request failed");

function deps(source: BotQuoteSource, cache: BotQuoteCache): ResolveFxRateDeps {
  return { source, cache, now: () => NOW };
}

describe("resolveFxRate", () => {
  it("needs no rate for TWD and makes no request", async () => {
    const source = fakeSource(OFFLINE);
    expect(
      unwrap(
        await resolveFxRate(
          "TWD",
          "2026-10-12T10:00:00+08:00",
          deps(source, fakeCache().cache),
        ),
      ),
    ).toEqual({
      status: "not-needed",
    });
    expect(source.calls).toEqual([]);
  });

  it("uses the live mid rate and caches the raw quote", async () => {
    const source = fakeSource({ kind: "found", quote: usdQuote("2026-10-12") });
    const { cache, saved } = fakeCache();

    const result = unwrap(
      await resolveFxRate(
        "USD",
        "2026-10-12T19:00:00-07:00",
        deps(source, cache),
      ),
    );

    // 洛杉磯 10/12 19:00 = 臺灣 10/13，向臺銀查 10/13
    expect(source.calls).toEqual([["USD", "2026-10-13"]]);
    expect(result).toEqual({
      status: "resolved",
      rate: "32.35",
      basis: "spot",
      source: "bot-live",
      quoteDate: "2026-10-12",
      cacheWriteFailed: false,
    });
    expect(saved).toEqual([usdQuote("2026-10-12")]);
  });

  it("still returns the live rate when caching fails, but flags it", async () => {
    const source = fakeSource({ kind: "found", quote: usdQuote("2026-10-12") });
    const result = unwrap(
      await resolveFxRate(
        "USD",
        "2026-10-12T10:00:00+08:00",
        deps(source, fakeCache([], { failWrite: true }).cache),
      ),
    );
    expect(result).toMatchObject({
      status: "resolved",
      source: "bot-live",
      cacheWriteFailed: true,
    });
  });

  it("falls back to a recent cached quote when offline", async () => {
    const { cache } = fakeCache([
      usdQuote("2026-10-09"),
      usdQuote("2026-10-02"),
    ]);
    const result = unwrap(
      await resolveFxRate(
        "USD",
        "2026-10-12T10:00:00+08:00",
        deps(fakeSource(OFFLINE), cache),
      ),
    );
    expect(result).toMatchObject({
      status: "resolved",
      source: "bot-cached",
      quoteDate: "2026-10-09",
    });
  });

  it("never uses a cached quote newer than the expense date", async () => {
    const { cache } = fakeCache([usdQuote("2026-10-12")]);
    const result = unwrap(
      await resolveFxRate(
        "USD",
        "2026-10-05T10:00:00+08:00",
        deps(fakeSource(OFFLINE), cache),
      ),
    );
    expect(result).toEqual({
      status: "manual-required",
      reason: "no-cached-quote",
    });
  });

  it("accepts a cached quote exactly 7 days old but not 8", async () => {
    const at = "2026-10-12T10:00:00+08:00";
    const sevenDays = unwrap(
      await resolveFxRate(
        "USD",
        at,
        deps(fakeSource(OFFLINE), fakeCache([usdQuote("2026-10-05")]).cache),
      ),
    );
    const eightDays = unwrap(
      await resolveFxRate(
        "USD",
        at,
        deps(fakeSource(OFFLINE), fakeCache([usdQuote("2026-10-04")]).cache),
      ),
    );
    expect(sevenDays).toMatchObject({
      status: "resolved",
      source: "bot-cached",
    });
    expect(eightDays).toEqual({
      status: "manual-required",
      reason: "cached-quote-too-old",
    });
  });

  it("asks for manual input when offline with no cache", async () => {
    const result = unwrap(
      await resolveFxRate(
        "USD",
        "2026-10-12T10:00:00+08:00",
        deps(fakeSource(OFFLINE), fakeCache().cache),
      ),
    );
    expect(result).toEqual({
      status: "manual-required",
      reason: "no-cached-quote",
    });
  });

  it("asks for manual input when the cache itself fails", async () => {
    const result = unwrap(
      await resolveFxRate(
        "USD",
        "2026-10-12T10:00:00+08:00",
        deps(fakeSource(OFFLINE), fakeCache([], { failRead: true }).cache),
      ),
    );
    expect(result).toEqual({
      status: "manual-required",
      reason: "cache-read-failed",
    });
  });

  it("asks for manual input when the cached quote is unusable", async () => {
    const broken: BotQuote = {
      currency: "USD",
      quoteDate: "2026-10-11",
      spotBuy: "33",
      spotSell: "32",
    };
    const result = unwrap(
      await resolveFxRate(
        "USD",
        "2026-10-12T10:00:00+08:00",
        deps(fakeSource(OFFLINE), fakeCache([broken]).cache),
      ),
    );
    expect(result).toEqual({
      status: "manual-required",
      reason: "cached-quote-unusable",
    });
  });

  it("goes straight to manual input when the bank does not quote the currency, ignoring the cache", async () => {
    const { cache } = fakeCache([usdQuote("2026-10-11")]);
    const result = unwrap(
      await resolveFxRate(
        "USD",
        "2026-10-12T10:00:00+08:00",
        deps(fakeSource({ kind: "currency-not-quoted" }), cache),
      ),
    );
    expect(result).toEqual({
      status: "manual-required",
      reason: "currency-not-quoted",
    });
  });

  it("uses a cached quote when the date is beyond the bank history range", async () => {
    const { cache } = fakeCache([usdQuote("2026-01-09")]);
    const result = unwrap(
      await resolveFxRate(
        "USD",
        "2026-01-10T10:00:00+08:00",
        deps(fakeSource({ kind: "date-out-of-range" }), cache),
      ),
    );
    expect(result).toMatchObject({
      status: "resolved",
      source: "bot-cached",
      quoteDate: "2026-01-09",
    });
  });

  it("reports date-out-of-range when neither the bank nor the cache has the date", async () => {
    const result = unwrap(
      await resolveFxRate(
        "USD",
        "2026-01-10T10:00:00+08:00",
        deps(fakeSource({ kind: "date-out-of-range" }), fakeCache().cache),
      ),
    );
    expect(result).toEqual({
      status: "manual-required",
      reason: "date-out-of-range",
    });
  });

  it("keeps the more specific cache reason when the out-of-range cache entry is too old", async () => {
    const { cache } = fakeCache([usdQuote("2025-12-01")]);
    const result = unwrap(
      await resolveFxRate(
        "USD",
        "2026-01-10T10:00:00+08:00",
        deps(fakeSource({ kind: "date-out-of-range" }), cache),
      ),
    );
    expect(result).toEqual({
      status: "manual-required",
      reason: "cached-quote-too-old",
    });
  });

  it("treats a live quote that breaks the source contract as a failure and uses the cache", async () => {
    const wrongDate = fakeSource({
      kind: "found",
      quote: usdQuote("2026-10-13"),
    });
    const { cache, saved } = fakeCache([usdQuote("2026-10-10")]);
    const result = unwrap(
      await resolveFxRate(
        "USD",
        "2026-10-12T10:00:00+08:00",
        deps(wrongDate, cache),
      ),
    );
    expect(result).toMatchObject({
      source: "bot-cached",
      quoteDate: "2026-10-10",
    });
    expect(saved).toEqual([]);
  });

  it("falls back to the cache when the live quote is unusable", async () => {
    const broken: BotQuote = {
      currency: "USD",
      quoteDate: "2026-10-12",
      spotBuy: "33",
      spotSell: "32",
    };
    const { cache, saved } = fakeCache([usdQuote("2026-10-11")]);
    const result = unwrap(
      await resolveFxRate(
        "USD",
        "2026-10-12T10:00:00+08:00",
        deps(fakeSource({ kind: "found", quote: broken }), cache),
      ),
    );
    expect(result).toMatchObject({
      source: "bot-cached",
      quoteDate: "2026-10-11",
    });
    expect(saved).toEqual([]);
  });

  it("rejects a future expense date", async () => {
    const result = await resolveFxRate(
      "USD",
      "2026-10-14T10:00:00+08:00",
      deps(fakeSource(OFFLINE), fakeCache().cache),
    );
    expect(unwrapErr(result)).toEqual({
      code: "FUTURE_DATE",
      date: "2026-10-14",
    });
  });

  it("rejects a timestamp without a time zone", async () => {
    const result = await resolveFxRate(
      "USD",
      "2026-10-12T10:00:00",
      deps(fakeSource(OFFLINE), fakeCache().cache),
    );
    expect(unwrapErr(result)).toEqual({
      code: "INVALID_TIMESTAMP",
      value: "2026-10-12T10:00:00",
    });
  });
});
