import { unwrap, unwrapErr } from "../ledger/testFixtures";
import { computeMidRate, formatDecimal } from "./midRate";

describe("computeMidRate", () => {
  it("averages buy and sell exactly", () => {
    expect(unwrap(computeMidRate("32.35", "32.45"))).toBe("32.4");
  });

  it("adds one decimal place when the sum is odd, without rounding", () => {
    // 臺銀越南盾現金報價範例
    expect(unwrap(computeMidRate("0.00097", "0.00138"))).toBe("0.001175");
  });

  it("aligns different decimal lengths", () => {
    expect(unwrap(computeMidRate("36.365", "36.9"))).toBe("36.6325");
  });

  it("returns the value itself when buy equals sell", () => {
    expect(unwrap(computeMidRate("4.6", "4.60"))).toBe("4.6");
  });

  it("produces a rate that the ledger parser accepts", () => {
    expect(unwrap(computeMidRate("0.2", "0.3"))).toBe("0.25");
    expect(unwrap(computeMidRate("31", "33"))).toBe("32");
  });

  it("rejects buy above sell, which signals swapped columns or bad data", () => {
    expect(unwrapErr(computeMidRate("32.5", "32.4"))).toEqual({
      code: "QUOTE_BUY_ABOVE_SELL",
      buy: "32.5",
      sell: "32.4",
    });
  });

  it.each([
    ["-", "1"],
    ["1", ""],
    ["0", "1"],
  ])("rejects invalid values (%p, %p)", (buy, sell) => {
    expect(unwrapErr(computeMidRate(buy, sell)).code).toBe(
      "INVALID_QUOTE_VALUE",
    );
  });
});

describe("formatDecimal", () => {
  it.each([
    [1175n, 6, "0.001175"],
    [32400n, 3, "32.4"],
    [32000n, 3, "32"],
    [5n, 0, "5"],
  ])("formats %p with scale %p as %p", (n, scale, expected) => {
    expect(formatDecimal(n, scale)).toBe(expected);
  });
});
