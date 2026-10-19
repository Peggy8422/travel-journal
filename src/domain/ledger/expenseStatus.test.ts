import type { ExpenseRecord, SettlementRecord } from "./records";
import { findExpenseStatuses } from "./expenseStatus";
import { unwrap, unwrapErr } from "./testFixtures";
import type { Ledger } from "./types";

const ledger: Ledger = {
  id: "l1",
  baseCurrency: "TWD",
  members: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
};

/** 依呼叫順序產生遞增的記錄時間，模擬實際的記錄先後 */
let clock = 0;
const nextRecordedAt = () =>
  new Date(Date.UTC(2026, 9, 1) + ++clock * 60_000).toISOString();

function expense(
  id: string,
  payerId: string,
  participantIds: string[],
  amountMinor = 100,
): ExpenseRecord {
  const recordedAt = nextRecordedAt();
  return {
    id,
    ledgerId: "l1",
    payerId,
    amountMinor,
    currency: "TWD",
    fx: null,
    split: { kind: "equal", participantIds },
    title: id,
    note: null,
    category: null,
    placeName: null,
    location: null,
    occurredAt: "2026-10-01T12:00:00+08:00",
    createdAt: recordedAt,
    updatedAt: recordedAt,
    deletedAt: null,
  };
}

function settlement(
  id: string,
  fromId: string,
  toId: string,
  amountMinor: number,
): SettlementRecord {
  const recordedAt = nextRecordedAt();
  return {
    id,
    ledgerId: "l1",
    fromId,
    toId,
    amountMinor,
    settledAt: "2026-10-05T20:00:00+08:00",
    createdAt: recordedAt,
    updatedAt: recordedAt,
    deletedAt: null,
  };
}

/** 回傳 { 消費 id: 狀態 }，沒有狀態的消費不會出現 */
const statuses = (expenses: ExpenseRecord[], settlements: SettlementRecord[]) =>
  Object.fromEntries(
    unwrap(findExpenseStatuses(ledger, expenses, settlements)),
  );

describe("findExpenseStatuses — settled", () => {
  it("gives no status while debts remain", () => {
    expect(statuses([expense("e1", "a", ["a", "b"])], [])).toEqual({});
  });

  it("settles expenses linked only through simplified debts", () => {
    // b 欠 a 100、c 欠 b 100，還款建議只有 c → a
    const lunch = expense("lunch", "a", ["b"]);
    const taxi = expense("taxi", "b", ["c"]);
    const pay = settlement("s1", "c", "a", 100);
    expect(statuses([lunch, taxi], [pay])).toEqual({
      lunch: "settled",
      taxi: "settled",
    });
  });

  it("does not mark expenses recorded after the settlement", () => {
    const before = expense("before", "a", ["a", "b"]);
    const pay = settlement("s1", "b", "a", 50);
    const after = expense("after", "a", ["a", "b"]);
    expect(statuses([before, after], [pay])).toEqual({ before: "settled" });
  });

  it("does not mark a backfilled expense dated before the settlement", () => {
    const ab = expense("ab", "a", ["a", "b"]);
    const pay = settlement("s1", "b", "a", 50);
    // 消費時間比還款早，但記錄得比較晚
    const backfilled = {
      ...expense("backfilled", "a", ["a", "c"]),
      occurredAt: "2026-09-01T12:00:00+08:00",
    };
    expect(statuses([ab, backfilled], [pay])).toEqual({ ab: "settled" });
  });

  it("marks only expenses whose members are all settled", () => {
    const ab = expense("ab", "a", ["a", "b"]); // b 欠 a 50
    const cd = expense("cd", "c", ["c", "d"]); // d 欠 c 50
    const pay = settlement("s1", "b", "a", 50);
    expect(statuses([ab, cd], [pay])).toEqual({ ab: "settled" });
  });

  it("keeps an expense open while another debt of its creditor remains", () => {
    const abc = expense("abc", "a", ["a", "b", "c"], 300); // b、c 各欠 a 100
    const pay = settlement("s1", "b", "a", 100);
    expect(statuses([abc], [pay])).toEqual({});
  });

  it("marks an expense once a later settlement completes it", () => {
    const abc = expense("abc", "a", ["a", "b", "c"], 300);
    const first = settlement("s1", "b", "a", 100);
    const second = settlement("s2", "c", "a", 100);
    expect(statuses([abc], [first, second])).toEqual({ abc: "settled" });
  });

  it("ignores deleted settlements and expenses", () => {
    const ab = expense("ab", "a", ["a", "b"]);
    const deletedPay = { ...settlement("s1", "b", "a", 50), deletedAt: "x" };
    expect(statuses([ab], [deletedPay])).toEqual({});

    const deleted = { ...expense("deleted", "a", ["a", "b"]), deletedAt: "x" };
    const pay = settlement("s2", "b", "a", 50);
    expect(statuses([ab, deleted], [pay])).toEqual({ ab: "settled" });
  });
});

describe("findExpenseStatuses — offset", () => {
  it("marks both expenses offset when they cancel each other out", () => {
    const first = expense("first", "a", ["b"]); // b 欠 a 100
    const second = expense("second", "b", ["a"]); // a 欠 b 100
    expect(statuses([first, second], [])).toEqual({
      first: "offset",
      second: "offset",
    });
  });

  it("keeps the offset status when a settlement happens later", () => {
    const first = expense("first", "a", ["b"]);
    const second = expense("second", "b", ["a"]);
    const other = expense("other", "c", ["d"]);
    const pay = settlement("s1", "d", "c", 100);
    expect(statuses([first, second, other], [pay])).toEqual({
      first: "offset",
      second: "offset",
      other: "settled",
    });
  });

  it("does not offset across members who still have other debts", () => {
    const first = expense("first", "a", ["b"]); // b 欠 a 100
    const second = expense("second", "b", ["a"], 60); // a 欠 b 60
    expect(statuses([first, second], [])).toEqual({});
  });

  it("gives no status to expenses that only the payer shares", () => {
    const ab = expense("ab", "a", ["a", "b"]);
    const pay = settlement("s1", "b", "a", 50);
    const snack = expense("snack", "a", ["a"]);
    const pay2 = settlement("s2", "c", "d", 10);
    expect(statuses([ab, snack], [pay, pay2])).toEqual({ ab: "settled" });
    expect(statuses([snack], [])).toEqual({});
  });

  it("counts as settled when a repayment and an offset together clear it", () => {
    const abc = expense("abc", "a", ["a", "b", "c"], 300); // b、c 各欠 a 100
    const pay = settlement("s1", "b", "a", 100);
    const back = expense("back", "c", ["a"]); // a 欠 c 100，補平 c 的欠款
    expect(statuses([abc, back], [pay])).toEqual({
      abc: "settled",
      back: "offset",
    });
  });
});

describe("findExpenseStatuses — ordering and errors", () => {
  it("treats an expense recorded at the same time as a settlement as earlier", () => {
    const ab = expense("ab", "a", ["a", "b"]);
    const pay = { ...settlement("s1", "b", "a", 50), createdAt: ab.createdAt };
    expect(statuses([ab], [pay])).toEqual({ ab: "settled" });
  });

  it("reports invalid stored data instead of guessing", () => {
    const broken = expense("broken", "a", ["stranger"]);
    expect(unwrapErr(findExpenseStatuses(ledger, [broken], [])).code).toBe(
      "INVALID_EXPENSE",
    );
    const badPay = settlement("s1", "a", "a", 50);
    expect(unwrapErr(findExpenseStatuses(ledger, [], [badPay])).code).toBe(
      "INVALID_SETTLEMENT",
    );
  });
});
