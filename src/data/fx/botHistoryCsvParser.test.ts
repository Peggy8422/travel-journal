import { findQuoteOnOrBefore, selectMidRate } from "../../domain/fx";
import { unwrap, unwrapErr } from "../../domain/ledger/testFixtures";
import {
  realBotDailyCsv,
  realBotUsdHistoryCsv as realCsv,
} from "./__fixtures__/botFixtures";
import { parseBotHistoryCsv } from "./botHistoryCsvParser";

describe("parseBotHistoryCsv — real Bank of Taiwan USD file", () => {
  const quotes = unwrap(parseBotHistoryCsv(realCsv, "USD"));

  it("parses every business day in the half-year range", () => {
    expect(quotes).toHaveLength(126);
    expect(quotes[0]?.quoteDate).toBe("2026-10-13");
    expect(quotes[quotes.length - 1]?.quoteDate).toBe("2026-04-14");
    expect(quotes.every((quote) => quote.currency === "USD")).toBe(true);
  });

  it("reads one day exactly, converting the compact date", () => {
    expect(quotes.find((quote) => quote.quoteDate === "2026-10-12")).toEqual({
      currency: "USD",
      quoteDate: "2026-10-12",
      cashBuy: "31.51000",
      cashSell: "32.18000",
      spotBuy: "31.86000",
      spotSell: "31.96000",
    });
  });

  it("skips non-business days, so a holiday maps to the previous business day", () => {
    // 2026-10-09（調整放假）與 10-10（國慶日）不在檔案中
    const quote = findQuoteOnOrBefore(quotes, "2026-10-10");
    expect(quote?.quoteDate).toBe("2026-10-08");
    expect(unwrap(selectMidRate(quote!))).toEqual({
      rate: "31.9",
      basis: "spot",
    });
  });
});

describe("parseBotHistoryCsv — format tolerance and errors", () => {
  it("accepts a file without BOM and with LF line endings", () => {
    const lfNoBom = realCsv.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
    expect(unwrap(parseBotHistoryCsv(lfNoBom, "USD"))).toEqual(
      unwrap(parseBotHistoryCsv(realCsv, "USD")),
    );
  });

  it("rejects the daily CSV, which lacks the date column (wrong URL served)", () => {
    expect(unwrapErr(parseBotHistoryCsv(realBotDailyCsv, "USD")).code).toBe(
      "UNEXPECTED_HEADER",
    );
  });

  it("rejects a file for a different currency than requested", () => {
    expect(unwrapErr(parseBotHistoryCsv(realCsv, "JPY"))).toEqual({
      code: "CURRENCY_MISMATCH",
      lineNumber: 2,
      expected: "JPY",
      actual: "USD",
    });
  });

  it.each(["2026-10-13", "20261341", "20260230", "1013"])(
    "rejects an invalid row date %p",
    (value) => {
      const csv = realCsv.replace("20261013,USD", `${value},USD`);
      expect(unwrapErr(parseBotHistoryCsv(csv, "USD"))).toEqual({
        code: "INVALID_ROW_DATE",
        lineNumber: 2,
        value,
      });
    },
  );

  it("rejects duplicate dates", () => {
    const csv = realCsv.replace("20261012,USD", "20261013,USD");
    expect(unwrapErr(parseBotHistoryCsv(csv, "USD"))).toEqual({
      code: "DUPLICATE_DATE",
      date: "2026-10-13",
    });
  });

  it("rejects a shifted row hidden by the trailing comma", () => {
    const csv = realCsv.replace(
      "20261013,USD,本行買入,31.68500,",
      "20261013,USD,本行買入,",
    );
    expect(unwrapErr(parseBotHistoryCsv(csv, "USD"))).toMatchObject({
      code: "MALFORMED_ROW",
      lineNumber: 2,
    });
  });

  it("rejects an empty file, a header-only file, and an HTML page", () => {
    expect(unwrapErr(parseBotHistoryCsv("", "USD"))).toEqual({
      code: "EMPTY_FILE",
    });
    expect(
      unwrapErr(parseBotHistoryCsv(realCsv.split("\r\n")[0] ?? "", "USD")),
    ).toEqual({ code: "NO_ROWS" });
    expect(
      unwrapErr(parseBotHistoryCsv("<html>查無資料</html>", "USD")).code,
    ).toBe("UNEXPECTED_HEADER");
  });
});
