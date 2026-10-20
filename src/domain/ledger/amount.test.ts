import { formatMinorAmount, parseAmountInput, toAmountInput } from "./amount";
import { unwrap, unwrapErr } from "./testFixtures";

describe("parseAmountInput", () => {
  it.each([
    ["300", "TWD", 300],
    ["1,500", "JPY", 1500],
    ["12.5", "USD", 1250],
    ["12.34", "USD", 1234],
    [" 0.01 ", "USD", 1],
    ["7", "USD", 700],
  ])("parses %s %s as %d minor units", (text, currency, expected) => {
    expect(unwrap(parseAmountInput(text, currency))).toBe(expected);
  });

  it("does not round extra decimals", () => {
    expect(unwrapErr(parseAmountInput("12.345", "USD"))).toEqual({
      code: "TOO_MANY_DECIMALS",
      currency: "USD",
      decimals: 2,
    });
    expect(unwrapErr(parseAmountInput("100.5", "TWD")).code).toBe(
      "TOO_MANY_DECIMALS",
    );
  });

  it.each(["", "abc", "-5", "1.", ".5", "01", "1e3"])("rejects %p", (text) => {
    expect(unwrapErr(parseAmountInput(text, "USD")).code).toBe(
      "INVALID_AMOUNT_INPUT",
    );
  });

  it("rejects zero and unsupported currencies", () => {
    expect(unwrapErr(parseAmountInput("0", "USD")).code).toBe(
      "AMOUNT_NOT_POSITIVE_INTEGER",
    );
    expect(unwrapErr(parseAmountInput("1", "XXX")).code).toBe(
      "UNSUPPORTED_CURRENCY",
    );
  });

  it("rejects amounts beyond the safe integer range", () => {
    expect(unwrapErr(parseAmountInput("90071992547409920", "TWD")).code).toBe(
      "AMOUNT_NOT_POSITIVE_INTEGER",
    );
  });
});

describe("formatMinorAmount", () => {
  it.each([
    [123450, "USD", "1,234.50"],
    [5, "USD", "0.05"],
    [-1250, "USD", "-12.50"],
    [1234567, "TWD", "1,234,567"],
    [-400, "TWD", "-400"],
    [0, "JPY", "0"],
    [999, "XXX", "999"],
  ])("formats %d %s as %s", (minor, currency, expected) => {
    expect(formatMinorAmount(minor, currency)).toBe(expected);
  });
});

describe("toAmountInput", () => {
  it.each([
    [123450, "USD", "1234.50"],
    [1500, "JPY", "1500"],
    [1234567, "TWD", "1234567"],
  ])("formats %d %s as %s without grouping", (minor, currency, expected) => {
    expect(toAmountInput(minor, currency)).toBe(expected);
  });

  it("round-trips through parseAmountInput", () => {
    expect(unwrap(parseAmountInput(toAmountInput(123405, "USD"), "USD"))).toBe(
      123405,
    );
  });
});
