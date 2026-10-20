import { describeAllocationGap, describeError } from "./messages";

describe("describeAllocationGap", () => {
  it("returns nothing when fully allocated", () => {
    expect(describeAllocationGap(0, "TWD")).toBeNull();
  });

  it("explains an under-allocation with the amount left", () => {
    expect(describeAllocationGap(50, "TWD")).toBe(
      "還有 TWD 50 沒有分配，請調整每個人的金額，讓加總等於消費金額。",
    );
  });

  it("explains an over-allocation in the currency's format", () => {
    expect(describeAllocationGap(-1250, "USD")).toBe(
      "分配的金額超出 USD 12.50，請調整每個人的金額，讓加總等於消費金額。",
    );
  });
});

describe("describeError", () => {
  it("explains a share sum mismatch in Chinese instead of showing the code", () => {
    expect(
      describeError({
        code: "EXACT_SHARES_SUM_MISMATCH",
        expectedMinor: 300,
        actualMinor: 250,
      }),
    ).toBe("每個人的分攤金額加總和消費金額不符");
  });

  it("includes the cause of invalid stored data", () => {
    expect(
      describeError({
        code: "INVALID_EXPENSE",
        expenseId: "e1",
        cause: { code: "UNKNOWN_MEMBER", memberId: "x" },
      }),
    ).toContain("有成員不在這本帳本中");
  });
});
