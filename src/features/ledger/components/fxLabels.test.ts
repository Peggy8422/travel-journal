import { describeStoredFx } from "./fxLabels";

describe("describeStoredFx", () => {
  it("names the Bank of Taiwan quote the rate came from", () => {
    expect(
      describeStoredFx(
        {
          rateToBase: "0.2134",
          source: "bot-cached",
          quoteDate: "2026-10-12",
          basis: "cash",
        },
        "JPY",
        "TWD",
      ),
    ).toBe("1 JPY = 0.2134 TWD · 臺灣銀行 2026-10-12 現金中價");
  });

  it("marks a rate typed in by hand", () => {
    expect(
      describeStoredFx({ rateToBase: "31.5", source: "manual" }, "USD", "TWD"),
    ).toBe("1 USD = 31.5 TWD · 手動輸入");
  });
});
