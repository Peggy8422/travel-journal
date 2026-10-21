import type { ExpenseRecord, MemberRecord } from "./records";
import {
  expenseMemberIds,
  toExpense,
  toLedger,
  validateNoArchivedMembers,
} from "./records";

const T0 = "2026-10-01T00:00:00.000Z";

const member = (id: string, sortOrder: number): MemberRecord => ({
  id,
  ledgerId: "l1",
  name: id,
  sortOrder,
  archivedAt: sortOrder === 1 ? T0 : null,
  isSelf: false,
  createdAt: T0,
});

const expense: ExpenseRecord = {
  id: "e1",
  ledgerId: "l1",
  payerId: "a",
  amountMinor: 3000,
  currency: "JPY",
  fx: { rateToBase: "0.2134", source: "manual" },
  split: { kind: "equal", participantIds: ["a", "b"] },
  title: "拉麵",
  note: null,
  category: null,
  placeName: null,
  location: null,
  occurredAt: "2026-10-12T12:00:00+09:00",
  createdAt: T0,
  updatedAt: T0,
  deletedAt: null,
};

describe("toLedger", () => {
  it("orders members by join order and keeps archived members", () => {
    const ledger = toLedger(
      {
        id: "l1",
        kind: "shared",
        name: "東京",
        baseCurrency: "TWD",
        createdAt: T0,
        updatedAt: T0,
      },
      [member("c", 2), member("a", 0), member("b", 1)],
    );
    expect(ledger).toEqual({
      id: "l1",
      baseCurrency: "TWD",
      members: [{ id: "a" }, { id: "b" }, { id: "c" }],
    });
  });
});

describe("toExpense", () => {
  it("keeps only the fields needed for calculation", () => {
    expect(toExpense(expense)).toEqual({
      id: "e1",
      payerId: "a",
      amountMinor: 3000,
      currency: "JPY",
      fxRateToBase: "0.2134",
      split: { kind: "equal", participantIds: ["a", "b"] },
      deletedAt: null,
    });
  });

  it("omits fxRateToBase for base-currency expenses", () => {
    const result = toExpense({ ...expense, currency: "TWD", fx: null });
    expect(result).not.toHaveProperty("fxRateToBase");
  });
});

describe("expenseMemberIds", () => {
  it("collects the payer and participants without duplicates", () => {
    expect(expenseMemberIds(expense)).toEqual(["a", "b"]);
    expect(
      expenseMemberIds({
        payerId: "c",
        split: { kind: "exact", shares: [{ memberId: "a", amountMinor: 1 }] },
      }),
    ).toEqual(["c", "a"]);
  });
});

describe("validateNoArchivedMembers", () => {
  const members = [member("a", 0), member("b", 1)]; // b is archived

  it("rejects an archived member", () => {
    expect(validateNoArchivedMembers(["a", "b"], members)).toEqual({
      ok: false,
      error: { code: "ARCHIVED_MEMBER", memberId: "b" },
    });
  });

  it("allows archived members that were already included", () => {
    expect(validateNoArchivedMembers(["a", "b"], members, ["b"]).ok).toBe(true);
  });

  it("leaves unknown members to computeShares", () => {
    expect(validateNoArchivedMembers(["zed"], members).ok).toBe(true);
  });
});
