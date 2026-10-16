import { unwrap, unwrapErr } from "../ledger/testFixtures";
import { addDays, toTaipeiDate } from "./taipeiDate";

describe("toTaipeiDate", () => {
  it("converts a Tokyo just-after-midnight timestamp to the previous Taipei date", () => {
    expect(unwrap(toTaipeiDate("2026-10-13T00:30:00+09:00"))).toBe(
      "2026-10-12",
    );
  });

  it("converts a Los Angeles evening timestamp to the next Taipei date", () => {
    expect(unwrap(toTaipeiDate("2026-10-12T20:00:00-07:00"))).toBe(
      "2026-10-13",
    );
  });

  it("handles UTC and fractional seconds", () => {
    expect(unwrap(toTaipeiDate("2026-10-12T16:00:00.000Z"))).toBe("2026-10-13");
    expect(unwrap(toTaipeiDate("2026-10-12T15:59:59Z"))).toBe("2026-10-12");
  });

  it.each([
    "2026-10-12T10:00:00",
    "2026-10-12",
    "yesterday",
    "2026-13-01T00:00:00Z",
  ])("rejects %p (missing zone or invalid)", (value) => {
    expect(unwrapErr(toTaipeiDate(value))).toEqual({
      code: "INVALID_TIMESTAMP",
      value,
    });
  });
});

describe("addDays", () => {
  it("crosses month and year boundaries", () => {
    expect(unwrap(addDays("2026-03-01", -1))).toBe("2026-02-28");
    expect(unwrap(addDays("2026-12-31", 1))).toBe("2027-01-01");
  });

  it.each(["2026-02-30", "2026/10/12", ""])(
    "rejects invalid date %p",
    (value) => {
      expect(unwrapErr(addDays(value, 1))).toEqual({
        code: "INVALID_DATE",
        value,
      });
    },
  );
});
