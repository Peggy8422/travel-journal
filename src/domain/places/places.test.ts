import { unwrap, unwrapErr } from "../ledger/testFixtures";
import { isPlaceKind, isPlaceStatus, parseRating } from "./records";

describe("saved place codes", () => {
  it("knows its kinds and statuses", () => {
    expect(isPlaceKind("cafe")).toBe(true);
    expect(isPlaceKind("onsen")).toBe(false);
    expect(isPlaceStatus("visited")).toBe(true);
    expect(isPlaceStatus("maybe")).toBe(false);
  });
});

describe("parseRating", () => {
  it("rounds and clamps the score", () => {
    expect(unwrap(parseRating({ criterionId: "taste", score: 4.6 }))).toEqual({
      criterionId: "taste",
      score: 5,
    });
    expect(unwrap(parseRating({ criterionId: "taste", score: 0 })).score).toBe(
      1,
    );
    expect(unwrap(parseRating({ criterionId: "taste", score: 12 })).score).toBe(
      5,
    );
  });

  it.each([
    ["not an object", 3],
    ["a missing criterion", { score: 3 }],
    ["a score that is not a number", { criterionId: "taste", score: "5" }],
    ["an endless score", { criterionId: "taste", score: Infinity }],
  ])("rejects %s", (_, value) => {
    expect(unwrapErr(parseRating(value))).toBeTruthy();
  });
});
