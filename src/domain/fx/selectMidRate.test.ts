import { unwrap, unwrapErr } from "../ledger/testFixtures";
import { selectMidRate } from "./selectMidRate";
import type { BotQuote } from "./types";

const base: BotQuote = { currency: "USD", quoteDate: "2026-10-12" };

describe("selectMidRate", () => {
  it("prefers spot when both spot sides exist", () => {
    const quote = {
      ...base,
      cashBuy: "31.8",
      cashSell: "32.9",
      spotBuy: "32.3",
      spotSell: "32.4",
    };
    expect(unwrap(selectMidRate(quote))).toEqual({
      rate: "32.35",
      basis: "spot",
    });
  });

  it("falls back to cash when spot is missing (e.g. KRW, VND)", () => {
    const quote = {
      ...base,
      currency: "VND",
      cashBuy: "0.00097",
      cashSell: "0.00138",
    };
    expect(unwrap(selectMidRate(quote))).toEqual({
      rate: "0.001175",
      basis: "cash",
    });
  });

  it("does not use a one-sided spot quote", () => {
    const quote = {
      ...base,
      spotBuy: "32.3",
      cashBuy: "31.8",
      cashSell: "32.9",
    };
    expect(unwrap(selectMidRate(quote)).basis).toBe("cash");
  });

  it("errors when no complete pair exists", () => {
    expect(unwrapErr(selectMidRate({ ...base, cashBuy: "31.8" }))).toEqual({
      code: "NO_USABLE_QUOTE",
      currency: "USD",
    });
  });

  it("propagates inconsistent data instead of silently using it", () => {
    expect(
      unwrapErr(selectMidRate({ ...base, spotBuy: "33", spotSell: "32" })).code,
    ).toBe("QUOTE_BUY_ABOVE_SELL");
  });
});
