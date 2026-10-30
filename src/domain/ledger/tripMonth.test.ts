import { isTripMonth } from "./tripMonth";

describe("isTripMonth", () => {
  it("accepts YYYY-MM with a real month", () => {
    expect(isTripMonth("2026-02")).toBe(true);
    expect(isTripMonth("2026-12")).toBe(true);
  });

  it("rejects other shapes and impossible months", () => {
    for (const value of [
      "2026-13",
      "2026-00",
      "2026-2",
      "2026-02-01",
      "",
      202602,
    ]) {
      expect(isTripMonth(value)).toBe(false);
    }
  });
});
