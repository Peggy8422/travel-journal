import type { BotQuote, BotQuoteCache } from "../../../domain/fx";
import {
  FIXTURE_NOW,
  realBotDailyCsv,
} from "../../../data/fx/__fixtures__/botFixtures";
import { refreshBotQuoteCache } from "./refreshBotQuoteCache";

function recordingCache(failAfter?: number) {
  const saved: BotQuote[] = [];
  const cache: BotQuoteCache = {
    findLatestOnOrBefore: async () => undefined,
    save: async (quote) => {
      if (failAfter !== undefined && saved.length >= failAfter)
        throw new Error("disk full");
      saved.push(quote);
    },
  };
  return { cache, saved };
}

const deps = (fetchDailyCsv: () => Promise<string>, cache: BotQuoteCache) => ({
  fetchDailyCsv,
  cache,
  now: () => FIXTURE_NOW,
});

describe("refreshBotQuoteCache", () => {
  it("caches every quoted currency with today's Taipei date", async () => {
    const { cache, saved } = recordingCache();
    const result = await refreshBotQuoteCache(
      deps(async () => realBotDailyCsv, cache),
    );
    expect(result).toEqual({
      status: "refreshed",
      quoteDate: "2026-10-13",
      count: 19,
    });
    expect(saved).toHaveLength(19);
    expect(saved.every((q) => q.quoteDate === "2026-10-13")).toBe(true);
  });

  it("reports a fetch failure without throwing and saves nothing", async () => {
    const { cache, saved } = recordingCache();
    const result = await refreshBotQuoteCache(
      deps(async () => {
        throw new Error("offline");
      }, cache),
    );
    expect(result).toEqual({ status: "fetch-failed" });
    expect(saved).toEqual([]);
  });

  it("distinguishes a format change from being offline", async () => {
    const { cache, saved } = recordingCache();
    const result = await refreshBotQuoteCache(
      deps(async () => "<html>維護中</html>", cache),
    );
    expect(result.status).toBe("format-changed");
    expect(saved).toEqual([]);
  });

  it("reports how many quotes were saved before a cache write failed", async () => {
    const { cache } = recordingCache(5);
    const result = await refreshBotQuoteCache(
      deps(async () => realBotDailyCsv, cache),
    );
    expect(result).toEqual({ status: "cache-write-failed", savedCount: 5 });
  });
});
