import { selectMidRate } from "../../domain/fx";
import { unwrap, unwrapErr } from "../../domain/ledger/testFixtures";
import { realBotDailyCsv as realCsv } from "./__fixtures__/botFixtures";
import { parseBotDailyCsv } from "./botDailyCsvParser";
const DATE = "2026-10-13";

const quoteOf = (csv: string, currency: string) =>
  unwrap(parseBotDailyCsv(csv, DATE)).find((q) => q.currency === currency);

describe("parseBotDailyCsv — real Bank of Taiwan file", () => {
  it("parses all 19 currencies", () => {
    const currencies = unwrap(parseBotDailyCsv(realCsv, DATE)).map(
      (q) => q.currency,
    );
    expect(currencies).toEqual([
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
    ]);
  });

  it("reads buy and sell from the correct blocks, keeping the original strings", () => {
    expect(quoteOf(realCsv, "USD")).toEqual({
      currency: "USD",
      quoteDate: DATE,
      cashBuy: "31.68000",
      cashSell: "32.35000",
      spotBuy: "32.00500",
      spotSell: "32.15500",
    });
  });

  it('treats 0.00000 as "no quote" for spot-less currencies', () => {
    expect(quoteOf(realCsv, "KRW")).toEqual({
      currency: "KRW",
      quoteDate: DATE,
      cashBuy: "0.02219",
      cashSell: "0.02609",
    });
  });

  it('treats 0.00000 as "no quote" for cash-less currencies', () => {
    expect(quoteOf(realCsv, "ZAR")).toEqual({
      currency: "ZAR",
      quoteDate: DATE,
      spotBuy: "1.90300",
      spotSell: "1.99300",
    });
  });

  it.each([
    ["USD", "32.08", "spot"],
    ["JPY", "0.2032", "spot"],
    ["ZAR", "1.948", "spot"],
    ["KRW", "0.02414", "cash"],
    ["VND", "0.001195", "cash"],
    ["IDR", "0.00173", "cash"],
  ])(
    "works end to end with selectMidRate: %s → %s (%s)",
    (currency, rate, basis) => {
      const quote = quoteOf(realCsv, currency);
      expect(quote).toBeDefined();
      expect(unwrap(selectMidRate(quote!))).toEqual({ rate, basis });
    },
  );
});

describe("parseBotDailyCsv — format tolerance", () => {
  it("accepts a file without BOM and with LF line endings", () => {
    const lfNoBom = realCsv.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
    expect(unwrap(parseBotDailyCsv(lfNoBom, DATE))).toEqual(
      unwrap(parseBotDailyCsv(realCsv, DATE)),
    );
  });

  it('accepts "-" as no quote', () => {
    const csv = realCsv.replace("USD,本行買入,31.68000", "USD,本行買入,-");
    expect(quoteOf(csv, "USD")?.cashBuy).toBeUndefined();
  });
});

describe("parseBotDailyCsv — format changes are detected, not guessed", () => {
  it("rejects a header where cash and spot columns were swapped", () => {
    const csv = realCsv.replace("幣別,匯率,現金,即期", "幣別,匯率,即期,現金");
    expect(unwrapErr(parseBotDailyCsv(csv, DATE)).code).toBe(
      "UNEXPECTED_HEADER",
    );
  });

  it("rejects a row whose buy and sell blocks are swapped", () => {
    const csv = realCsv.replace("USD,本行買入", "USD,本行賣出");
    expect(unwrapErr(parseBotDailyCsv(csv, DATE))).toMatchObject({
      code: "MALFORMED_ROW",
      lineNumber: 2,
    });
  });

  it("rejects a row whose sell block label is wrong", () => {
    const csv = realCsv.replace(
      /^(USD,本行買入(?:,[^,]*){9}),本行賣出/m,
      "$1,本行買入",
    );
    expect(unwrapErr(parseBotDailyCsv(csv, DATE))).toMatchObject({
      code: "MALFORMED_ROW",
      lineNumber: 2,
    });
  });

  it("rejects a row with one missing column even though the trailing comma keeps the count right", () => {
    const csv = realCsv.replace("USD,本行買入,31.68000,", "USD,本行買入,");
    expect(unwrapErr(parseBotDailyCsv(csv, DATE))).toEqual({
      code: "MALFORMED_ROW",
      lineNumber: 2,
      reason: "unexpected empty cell, columns may be shifted",
    });
  });

  it("rejects a row with the wrong column count", () => {
    const csv = realCsv.replace(
      "USD,本行買入,31.68000,32.00500,",
      "USD,本行買入,",
    );
    expect(unwrapErr(parseBotDailyCsv(csv, DATE))).toMatchObject({
      code: "MALFORMED_ROW",
      lineNumber: 2,
    });
  });

  it("rejects a non-numeric value with its line number", () => {
    const csv = realCsv.replace("HKD,本行買入,3.93200", "HKD,本行買入,N/A");
    expect(unwrapErr(parseBotDailyCsv(csv, DATE))).toEqual({
      code: "INVALID_VALUE",
      lineNumber: 3,
      value: "N/A",
    });
  });

  it("rejects an invalid currency code", () => {
    const csv = realCsv.replace("HKD,本行買入", "港幣,本行買入");
    expect(unwrapErr(parseBotDailyCsv(csv, DATE))).toMatchObject({
      code: "MALFORMED_ROW",
      lineNumber: 3,
    });
  });

  it("rejects duplicate currencies", () => {
    const csv = realCsv.replace("HKD,本行買入", "USD,本行買入");
    expect(unwrapErr(parseBotDailyCsv(csv, DATE))).toEqual({
      code: "DUPLICATE_CURRENCY",
      currency: "USD",
    });
  });

  it("rejects an empty file and a header-only file", () => {
    expect(unwrapErr(parseBotDailyCsv("", DATE))).toEqual({
      code: "EMPTY_FILE",
    });
    const headerOnly = realCsv.split("\r\n")[0] ?? "";
    expect(unwrapErr(parseBotDailyCsv(headerOnly, DATE))).toEqual({
      code: "NO_ROWS",
    });
  });

  it("rejects an HTML error page served instead of CSV", () => {
    expect(
      unwrapErr(parseBotDailyCsv("<!DOCTYPE html><html>維護中</html>", DATE))
        .code,
    ).toBe("UNEXPECTED_HEADER");
  });

  it("throws on an invalid quoteDate, which is a caller bug", () => {
    expect(() => parseBotDailyCsv(realCsv, "2026/10/13")).toThrow(RangeError);
  });
});
