import { expenseFxFromResolution, manualFx } from "./expenseFx";

describe("expenseFxFromResolution", () => {
  it("maps each resolution status", () => {
    expect(expenseFxFromResolution({ status: "not-needed" })).toBeNull();
    expect(
      expenseFxFromResolution({
        status: "resolved",
        rate: "0.2134",
        basis: "spot",
        source: "bot-cached",
        quoteDate: "2026-10-09",
        cacheWriteFailed: false,
      }),
    ).toEqual({
      rateToBase: "0.2134",
      source: "bot-cached",
      quoteDate: "2026-10-09",
      basis: "spot",
    });
    expect(
      expenseFxFromResolution({
        status: "manual-required",
        reason: "no-cached-quote",
      }),
    ).toBeUndefined();
  });

  it("builds a manual fx", () => {
    expect(manualFx("0.21")).toEqual({ rateToBase: "0.21", source: "manual" });
  });
});
