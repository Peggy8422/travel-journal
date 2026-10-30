import { SUPPORTED_CURRENCIES } from "../../../domain/ledger";
import { currencyLabel } from "./currencies";

describe("currencyLabel", () => {
  it("has a Chinese name for every supported currency", () => {
    for (const code of SUPPORTED_CURRENCIES) {
      expect(currencyLabel(code)).not.toBe(code);
    }
  });

  it("shows the code with its name", () => {
    expect(currencyLabel("JPY")).toBe("JPY 日圓");
  });
});
