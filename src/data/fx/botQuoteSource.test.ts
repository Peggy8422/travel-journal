import { getCurrencyDecimals } from "../../domain/ledger";
import { unwrap } from "../../domain/ledger/testFixtures";
import {
  FIXTURE_NOW,
  realBotDailyCsv,
  realBotUsdHistoryCsv,
} from "./__fixtures__/botFixtures";
import { parseBotDailyCsv } from "./botDailyCsvParser";
import {
  BOT_QUOTED_CURRENCIES,
  BotCsvFormatError,
  createBotQuoteSource,
} from "./botQuoteSource";

function setup(
  options: {
    daily?: string | Error;
    history?: string | Error;
    now?: Date;
  } = {},
) {
  const respond = (value: string | Error) => async () => {
    if (value instanceof Error) throw value;
    return value;
  };
  const fetchDailyCsv = jest.fn(respond(options.daily ?? realBotDailyCsv));
  const fetchHistoryCsv = jest.fn(
    respond(options.history ?? realBotUsdHistoryCsv),
  );
  const now = options.now ?? FIXTURE_NOW;
  return {
    fetchDailyCsv,
    fetchHistoryCsv,
    source: createBotQuoteSource({
      fetchDailyCsv,
      fetchHistoryCsv,
      now: () => now,
    }),
  };
}

describe("createBotQuoteSource — today", () => {
  it("uses the daily CSV and dates the quote with the Taipei date", async () => {
    const { source, fetchHistoryCsv } = setup();
    const result = await source.fetchQuote("JPY", "2026-10-13");
    expect(result).toEqual({
      kind: "found",
      quote: {
        currency: "JPY",
        quoteDate: "2026-10-13",
        cashBuy: "0.19390",
        cashSell: "0.20670",
        spotBuy: "0.20070",
        spotSell: "0.20570",
      },
    });
    expect(fetchHistoryCsv).not.toHaveBeenCalled();
  });

  it("uses the Taipei date even when the device clock is in UTC", async () => {
    const { source } = setup({ now: new Date("2026-10-13T16:30:00Z") }); // 臺灣 10/14 00:30
    await expect(source.fetchQuote("USD", "2026-10-14")).resolves.toMatchObject(
      { quote: { quoteDate: "2026-10-14" } },
    );
  });

  it("throws a format error when the daily CSV no longer matches", async () => {
    const { source } = setup({
      daily: realBotDailyCsv.replace("幣別", "Currency"),
    });
    await expect(source.fetchQuote("USD", "2026-10-13")).rejects.toBeInstanceOf(
      BotCsvFormatError,
    );
  });
});

describe("createBotQuoteSource — past dates", () => {
  it("uses the history CSV and picks the previous business day for a holiday", async () => {
    const { source, fetchHistoryCsv, fetchDailyCsv } = setup();
    const result = await source.fetchQuote("USD", "2026-10-10");
    expect(result).toMatchObject({
      kind: "found",
      quote: { quoteDate: "2026-10-08", spotBuy: "31.85000" },
    });
    expect(fetchHistoryCsv).toHaveBeenCalledWith("USD");
    expect(fetchDailyCsv).not.toHaveBeenCalled();
  });

  it("reports date-out-of-range before the earliest history row", async () => {
    const { source } = setup();
    await expect(source.fetchQuote("USD", "2026-04-13")).resolves.toEqual({
      kind: "date-out-of-range",
    });
  });

  it("throws a format error when the history file is for another currency", async () => {
    const { source } = setup();
    await expect(source.fetchQuote("JPY", "2026-10-12")).rejects.toBeInstanceOf(
      BotCsvFormatError,
    );
  });

  it("propagates network errors", async () => {
    const offline = new Error("offline");
    const { source } = setup({ history: offline });
    await expect(source.fetchQuote("USD", "2026-10-12")).rejects.toBe(offline);
  });
});

describe("createBotQuoteSource — guards", () => {
  it("reports an unquoted currency without any request", async () => {
    const { source, fetchDailyCsv, fetchHistoryCsv } = setup();
    await expect(source.fetchQuote("MOP", "2026-10-12")).resolves.toEqual({
      kind: "currency-not-quoted",
    });
    expect(fetchDailyCsv).not.toHaveBeenCalled();
    expect(fetchHistoryCsv).not.toHaveBeenCalled();
  });

  it("refuses future dates", async () => {
    await expect(
      setup().source.fetchQuote("USD", "2026-10-14"),
    ).rejects.toBeInstanceOf(RangeError);
  });
});

describe("Bank of Taiwan currency list", () => {
  const dailyCurrencies = unwrap(
    parseBotDailyCsv(realBotDailyCsv, "2026-10-13"),
  ).map((q) => q.currency);

  it("matches the currencies in the real daily CSV", () => {
    // 臺銀增減幣別、更新範例檔後，這個測試會提醒同步更新清單
    expect([...BOT_QUOTED_CURRENCIES].sort()).toEqual(
      [...dailyCurrencies].sort(),
    );
  });

  it("are all supported by the ledger", () => {
    expect(
      BOT_QUOTED_CURRENCIES.filter((c) => !getCurrencyDecimals(c).ok),
    ).toEqual([]);
  });
});
