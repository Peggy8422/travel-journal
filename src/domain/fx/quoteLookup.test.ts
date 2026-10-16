import { findQuoteOnOrBefore } from "./quoteLookup";
import type { BotQuote } from "./types";

const q = (quoteDate: string): BotQuote => ({
  currency: "USD",
  quoteDate,
  spotBuy: "1",
  spotSell: "1",
});

describe("findQuoteOnOrBefore", () => {
  const quotes = [q("2026-10-13"), q("2026-10-12"), q("2026-10-08")]; // 10/9、10/10 為假日

  it("returns the exact date when present", () => {
    expect(findQuoteOnOrBefore(quotes, "2026-10-12")?.quoteDate).toBe(
      "2026-10-12",
    );
  });

  it("returns the previous business day for a holiday", () => {
    expect(findQuoteOnOrBefore(quotes, "2026-10-10")?.quoteDate).toBe(
      "2026-10-08",
    );
  });

  it("does not depend on input order", () => {
    expect(
      findQuoteOnOrBefore([...quotes].reverse(), "2026-10-11")?.quoteDate,
    ).toBe("2026-10-08");
  });

  it("returns undefined before the earliest quote", () => {
    expect(findQuoteOnOrBefore(quotes, "2026-10-07")).toBeUndefined();
    expect(findQuoteOnOrBefore([], "2026-10-07")).toBeUndefined();
  });
});
