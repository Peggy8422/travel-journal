import { convertToBase, getCurrencyDecimals, parseFxRate } from "./currency";
import { unwrap, unwrapErr } from "./testFixtures";

describe("getCurrencyDecimals", () => {
  it("returns 0 for TWD and JPY, 2 for USD", () => {
    expect(unwrap(getCurrencyDecimals("TWD"))).toBe(0);
    expect(unwrap(getCurrencyDecimals("JPY"))).toBe(0);
    expect(unwrap(getCurrencyDecimals("USD"))).toBe(2);
  });

  it("rejects currencies not in the table instead of guessing", () => {
    expect(unwrapErr(getCurrencyDecimals("XYZ"))).toEqual({
      code: "UNSUPPORTED_CURRENCY",
      currency: "XYZ",
    });
  });
});

describe("parseFxRate", () => {
  it("parses decimal strings into an exact integer ratio", () => {
    expect(unwrap(parseFxRate("0.2134"))).toEqual({
      numerator: 2134n,
      scale: 4,
    });
    expect(unwrap(parseFxRate("32"))).toEqual({ numerator: 32n, scale: 0 });
  });

  it.each([
    "",
    "abc",
    "-1",
    "0",
    "0.000",
    "1.",
    ".5",
    "1e3",
    "01.5",
    " 1",
    "1,5",
    "0.12345678901",
  ])("rejects invalid rate %p", (rate) => {
    expect(unwrapErr(parseFxRate(rate))).toEqual({
      code: "INVALID_FX_RATE",
      rate,
    });
  });
});

describe("convertToBase", () => {
  it("returns the amount unchanged for the same currency", () => {
    expect(unwrap(convertToBase(500, "TWD", "TWD", undefined))).toBe(500);
  });

  it("rejects a rate when currencies are the same, so a stale rate cannot slip in", () => {
    expect(unwrapErr(convertToBase(500, "TWD", "TWD", "1"))).toEqual({
      code: "FX_RATE_UNEXPECTED",
    });
  });

  it("requires a rate for a foreign currency", () => {
    expect(unwrapErr(convertToBase(1000, "JPY", "TWD", undefined))).toEqual({
      code: "FX_RATE_REQUIRED",
    });
  });

  it("converts JPY to TWD and rounds once", () => {
    // 1000 × 0.2134 = 213.4 → 213
    expect(unwrap(convertToBase(1000, "JPY", "TWD", "0.2134"))).toBe(213);
  });

  it("rounds half up", () => {
    // 50 × 0.21 = 10.5 → 11
    expect(unwrap(convertToBase(50, "JPY", "TWD", "0.21"))).toBe(11);
  });

  it("accounts for minor-unit differences between currencies", () => {
    // USD 12.34 × 32.5 = 401.05 → TWD 401
    expect(unwrap(convertToBase(1234, "USD", "TWD", "32.5"))).toBe(401);
    // TWD 1000 × 0.0307 = USD 30.70 → 3070 cents
    expect(unwrap(convertToBase(1000, "TWD", "USD", "0.0307"))).toBe(3070);
  });

  it("avoids the floating point trap where 100 × 1.005 = 100.4999…", () => {
    expect(unwrap(convertToBase(100, "JPY", "TWD", "1.005"))).toBe(101);
  });

  it("rejects a conversion that rounds down to zero", () => {
    // 1 × 0.2 = 0.2 → 0
    expect(unwrapErr(convertToBase(1, "JPY", "TWD", "0.2"))).toEqual({
      code: "CONVERTED_AMOUNT_ZERO",
    });
  });

  it("rejects a result beyond the safe integer range", () => {
    expect(
      unwrapErr(convertToBase(Number.MAX_SAFE_INTEGER, "JPY", "TWD", "1000")),
    ).toEqual({
      code: "CONVERTED_AMOUNT_TOO_LARGE",
    });
  });

  it("reports an unsupported base currency", () => {
    expect(unwrapErr(convertToBase(100, "TWD", "XYZ", "1.5"))).toEqual({
      code: "UNSUPPORTED_CURRENCY",
      currency: "XYZ",
    });
  });

  it("propagates an invalid rate", () => {
    expect(unwrapErr(convertToBase(100, "JPY", "TWD", "-0.2"))).toEqual({
      code: "INVALID_FX_RATE",
      rate: "-0.2",
    });
  });

  it("reports an unsupported currency", () => {
    expect(unwrapErr(convertToBase(100, "XYZ", "TWD", "1.5"))).toEqual({
      code: "UNSUPPORTED_CURRENCY",
      currency: "XYZ",
    });
  });
});
