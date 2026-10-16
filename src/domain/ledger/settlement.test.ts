import { validateSettlement } from "./settlement";
import { ledgerTWD, unwrap, unwrapErr } from "./testFixtures";

describe("validateSettlement", () => {
  const settlement = { id: "s1", fromId: "b", toId: "a", amountMinor: 100 };

  it("accepts a valid settlement", () => {
    expect(unwrap(validateSettlement(settlement, ledgerTWD))).toBe(settlement);
  });

  it("rejects paying yourself", () => {
    expect(
      unwrapErr(validateSettlement({ ...settlement, toId: "b" }, ledgerTWD)),
    ).toEqual({
      code: "SELF_SETTLEMENT",
      memberId: "b",
    });
  });

  it.each([0, -5, 1.5])("rejects amount %p", (amountMinor) => {
    expect(
      unwrapErr(validateSettlement({ ...settlement, amountMinor }, ledgerTWD)),
    ).toEqual({
      code: "AMOUNT_NOT_POSITIVE_INTEGER",
      amountMinor,
    });
  });

  it("rejects unknown members on either side", () => {
    expect(
      unwrapErr(validateSettlement({ ...settlement, fromId: "x" }, ledgerTWD)),
    ).toEqual({
      code: "UNKNOWN_MEMBER",
      memberId: "x",
    });
    expect(
      unwrapErr(validateSettlement({ ...settlement, toId: "y" }, ledgerTWD)),
    ).toEqual({
      code: "UNKNOWN_MEMBER",
      memberId: "y",
    });
  });
});
