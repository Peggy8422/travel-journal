import { computeShares } from "./split";
import { ledgerTWD, makeExpense, unwrap, unwrapErr } from "./testFixtures";

const sharesOf = (result: ReturnType<typeof computeShares>) =>
  Object.fromEntries(unwrap(result));

describe("computeShares — equal split", () => {
  it("gives the extra unit to the earliest-joined member", () => {
    const expense = makeExpense({ amountMinor: 100 });
    expect(sharesOf(computeShares(expense, ledgerTWD))).toEqual({
      a: 34,
      b: 33,
      c: 33,
    });
  });

  it("uses ledger join order, not the order participants were selected in the UI", () => {
    const expense = makeExpense({
      amountMinor: 100,
      split: { kind: "equal", participantIds: ["c", "a", "b"] },
    });
    expect(sharesOf(computeShares(expense, ledgerTWD))).toEqual({
      a: 34,
      b: 33,
      c: 33,
    });
  });

  it("only includes selected participants; the payer does not have to participate", () => {
    const expense = makeExpense({
      payerId: "a",
      amountMinor: 101,
      split: { kind: "equal", participantIds: ["b", "c"] },
    });
    expect(sharesOf(computeShares(expense, ledgerTWD))).toEqual({
      b: 51,
      c: 50,
    });
  });
});

describe("computeShares — exact split", () => {
  it("returns the given amounts when currency equals base", () => {
    const expense = makeExpense({
      amountMinor: 100,
      split: {
        kind: "exact",
        shares: [
          { memberId: "a", amountMinor: 60 },
          { memberId: "c", amountMinor: 40 },
        ],
      },
    });
    expect(sharesOf(computeShares(expense, ledgerTWD))).toEqual({
      a: 60,
      c: 40,
    });
  });

  it("rejects shares that do not add up to the total", () => {
    const expense = makeExpense({
      amountMinor: 100,
      split: {
        kind: "exact",
        shares: [
          { memberId: "a", amountMinor: 60 },
          { memberId: "b", amountMinor: 30 },
        ],
      },
    });
    expect(unwrapErr(computeShares(expense, ledgerTWD))).toEqual({
      code: "EXACT_SHARES_SUM_MISMATCH",
      expectedMinor: 100,
      actualMinor: 90,
    });
  });

  it.each([0, -10, 12.5])(
    "rejects a non-positive or fractional share (%p)",
    (amountMinor) => {
      const expense = makeExpense({
        amountMinor: 100,
        split: {
          kind: "exact",
          shares: [
            { memberId: "a", amountMinor: 100 },
            { memberId: "b", amountMinor },
          ],
        },
      });
      expect(unwrapErr(computeShares(expense, ledgerTWD))).toEqual({
        code: "SHARE_NOT_POSITIVE_INTEGER",
        memberId: "b",
        amountMinor,
      });
    },
  );
});

describe("computeShares — foreign currency", () => {
  it("converts the total first, then splits in base currency", () => {
    // JPY 1001 × 0.2134 = 213.61 → TWD 214 → 72 / 71 / 71
    const expense = makeExpense({
      amountMinor: 1001,
      currency: "JPY",
      fxRateToBase: "0.2134",
    });
    expect(sharesOf(computeShares(expense, ledgerTWD))).toEqual({
      a: 72,
      b: 71,
      c: 71,
    });
  });

  it("splits exact shares proportionally after conversion", () => {
    // USD 10 + USD 20 = USD 30 × 32.53 = 975.9 → TWD 976 → 1:2 → 325.33 / 650.67 → 325 / 651
    const expense = makeExpense({
      amountMinor: 3000,
      currency: "USD",
      fxRateToBase: "32.53",
      split: {
        kind: "exact",
        shares: [
          { memberId: "a", amountMinor: 1000 },
          { memberId: "b", amountMinor: 2000 },
        ],
      },
    });
    expect(sharesOf(computeShares(expense, ledgerTWD))).toEqual({
      a: 325,
      b: 651,
    });
  });

  it("propagates conversion errors", () => {
    expect(
      unwrapErr(computeShares(makeExpense({ currency: "JPY" }), ledgerTWD)),
    ).toEqual({ code: "FX_RATE_REQUIRED" });
    expect(
      unwrapErr(
        computeShares(
          makeExpense({ amountMinor: 1, currency: "JPY", fxRateToBase: "0.2" }),
          ledgerTWD,
        ),
      ),
    ).toEqual({ code: "CONVERTED_AMOUNT_ZERO" });
  });
});

describe("computeShares — validation", () => {
  it.each([0, -100, 10.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])(
    "rejects amount %p",
    (amountMinor) => {
      expect(
        unwrapErr(computeShares(makeExpense({ amountMinor }), ledgerTWD)),
      ).toEqual({
        code: "AMOUNT_NOT_POSITIVE_INTEGER",
        amountMinor,
      });
    },
  );

  it("rejects an unknown payer", () => {
    expect(
      unwrapErr(computeShares(makeExpense({ payerId: "zzz" }), ledgerTWD)),
    ).toEqual({
      code: "UNKNOWN_MEMBER",
      memberId: "zzz",
    });
  });

  it("rejects an unknown participant", () => {
    const expense = makeExpense({
      split: { kind: "equal", participantIds: ["a", "zzz"] },
    });
    expect(unwrapErr(computeShares(expense, ledgerTWD))).toEqual({
      code: "UNKNOWN_MEMBER",
      memberId: "zzz",
    });
  });

  it("rejects an empty participant list for both split kinds", () => {
    expect(
      unwrapErr(
        computeShares(
          makeExpense({ split: { kind: "equal", participantIds: [] } }),
          ledgerTWD,
        ),
      ),
    ).toEqual({ code: "NO_PARTICIPANTS" });
    expect(
      unwrapErr(
        computeShares(
          makeExpense({ split: { kind: "exact", shares: [] } }),
          ledgerTWD,
        ),
      ),
    ).toEqual({
      code: "NO_PARTICIPANTS",
    });
  });

  it("rejects duplicate participants", () => {
    const expense = makeExpense({
      split: { kind: "equal", participantIds: ["a", "b", "a"] },
    });
    expect(unwrapErr(computeShares(expense, ledgerTWD))).toEqual({
      code: "DUPLICATE_PARTICIPANT",
      memberId: "a",
    });
  });
});
