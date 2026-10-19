import type { BotQuote } from "../../domain/fx";
import { createTestDatabase } from "../db/testDatabase";
import { createBotQuoteCacheRepository } from "./botQuoteCacheRepository";

const usd = (quoteDate: string, spotSell = "32.1"): BotQuote => ({
  currency: "USD",
  quoteDate,
  cashBuy: "31.5",
  cashSell: "32.3",
  spotBuy: "31.9",
  spotSell,
});

async function setup() {
  const db = await createTestDatabase();
  return {
    db,
    cache: createBotQuoteCacheRepository(
      db,
      () => new Date("2026-10-13T08:42:00Z"),
    ),
  };
}

describe("BotQuoteCache (SQLite)", () => {
  it("returns the latest quote on or before the date", async () => {
    const { cache } = await setup();
    await cache.save(usd("2026-10-09"));
    await cache.save(usd("2026-10-12"));
    await cache.save(usd("2026-10-14"));

    expect(await cache.findLatestOnOrBefore("USD", "2026-10-13")).toEqual(
      usd("2026-10-12"),
    );
    expect(await cache.findLatestOnOrBefore("USD", "2026-10-12")).toEqual(
      usd("2026-10-12"),
    );
    expect(
      await cache.findLatestOnOrBefore("USD", "2026-10-01"),
    ).toBeUndefined();
    expect(
      await cache.findLatestOnOrBefore("JPY", "2026-10-13"),
    ).toBeUndefined();
  });

  it("overwrites the same currency and date with the newer quote", async () => {
    const { cache } = await setup();
    await cache.save(usd("2026-10-12", "32.1"));
    await cache.save(usd("2026-10-12", "32.2"));
    expect(
      (await cache.findLatestOnOrBefore("USD", "2026-10-12"))?.spotSell,
    ).toBe("32.2");
  });

  it("keeps missing quote fields undefined, not null", async () => {
    const { cache } = await setup();
    const cashOnly: BotQuote = {
      currency: "VND",
      quoteDate: "2026-10-12",
      cashBuy: "0.00098",
      cashSell: "0.00138",
    };
    await cache.save(cashOnly);
    expect(await cache.findLatestOnOrBefore("VND", "2026-10-12")).toStrictEqual(
      cashOnly,
    );
  });

  it("records when the quote was saved", async () => {
    const { db, cache } = await setup();
    await cache.save(usd("2026-10-12"));
    const row = await db.getFirstAsync<{ fetched_at: string }>(
      "SELECT fetched_at FROM bot_quotes",
    );
    expect(row?.fetched_at).toBe("2026-10-13T08:42:00.000Z");
  });
});
