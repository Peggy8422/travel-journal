import {
  describeAllocationGap,
  describeError,
  describeRestoreReport,
} from "./messages";

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

describe("describeRestoreReport", () => {
  const ledger = (name: string) => ({
    id: name,
    kind: "shared" as const,
    name,
    baseCurrency: "TWD",
    createdAt: "",
    updatedAt: "",
  });

  it("lists restored, skipped and failed ledgers on separate lines", () => {
    expect(
      describeRestoreReport({
        restored: [ledger("東京"), ledger("大阪")],
        skipped: [ledger("首爾")],
        failed: [{ ledger: ledger("壞掉的"), reason: "FOREIGN KEY" }],
        personalExpensesAdded: 2,
      }),
    ).toBe(
      [
        "已還原 2 本：「東京」、「大阪」",
        "手機上已經有 1 本，沒有變動：「首爾」",
        "1 本資料有誤，沒有還原：「壞掉的」",
        "個人消費補進 2 筆",
      ].join("\n"),
    );
  });

  it("explains an empty backup", () => {
    expect(
      describeRestoreReport({
        restored: [],
        skipped: [],
        failed: [],
        personalExpensesAdded: 0,
      }),
    ).toBe("備份裡沒有任何帳本");
  });
});
