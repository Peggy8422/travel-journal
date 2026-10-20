import { parseShareInputs, remainingToAllocate } from "./exactSplitInput";
import { unwrap, unwrapErr } from "./testFixtures";

describe("parseShareInputs", () => {
  it("parses amounts in the currency's minor units and skips blanks", () => {
    expect(
      unwrap(
        parseShareInputs(
          [
            { memberId: "a", text: "12.5" },
            { memberId: "b", text: "  " },
            { memberId: "c", text: "7" },
          ],
          "USD",
        ),
      ),
    ).toEqual([
      { memberId: "a", amountMinor: 1250 },
      { memberId: "c", amountMinor: 700 },
    ]);
  });

  it("points at the member whose input is invalid", () => {
    expect(
      unwrapErr(
        parseShareInputs(
          [
            { memberId: "a", text: "100" },
            { memberId: "b", text: "1.5" },
          ],
          "TWD",
        ),
      ),
    ).toEqual({
      code: "INVALID_SHARE_INPUT",
      memberId: "b",
      cause: { code: "TOO_MANY_DECIMALS", currency: "TWD", decimals: 0 },
    });
  });

  it("rejects zero, since a member who pays nothing should be left blank", () => {
    const error = unwrapErr(
      parseShareInputs([{ memberId: "a", text: "0" }], "TWD"),
    );
    expect(error).toMatchObject({
      code: "INVALID_SHARE_INPUT",
      cause: { code: "AMOUNT_NOT_POSITIVE_INTEGER" },
    });
  });
});

describe("remainingToAllocate", () => {
  const shares = [
    { memberId: "a", amountMinor: 100 },
    { memberId: "b", amountMinor: 150 },
  ];

  it("returns what is left to allocate", () => {
    expect(remainingToAllocate(300, shares)).toBe(50);
    expect(remainingToAllocate(250, shares)).toBe(0);
  });

  it("goes negative when over-allocated", () => {
    expect(remainingToAllocate(200, shares)).toBe(-50);
  });
});
