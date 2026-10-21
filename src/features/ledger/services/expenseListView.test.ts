import { makeExpenseRecord } from "../../../data/repositories/testRecords";
import {
  filterExpenses,
  groupByLocalDay,
  isFiltering,
  NO_FILTER,
} from "./expenseListView";

const lunch = makeExpenseRecord({
  id: "lunch",
  payerId: "a",
  split: { kind: "equal", participantIds: ["a", "b"] },
  category: "food",
  occurredAt: "2026-10-12T12:00:00+09:00",
});
const taxi = makeExpenseRecord({
  id: "taxi",
  payerId: "c",
  split: { kind: "exact", shares: [{ memberId: "c", amountMinor: 3000 }] },
  category: "transport",
  occurredAt: "2026-10-12T21:00:00+09:00",
});
const snack = makeExpenseRecord({
  id: "snack",
  payerId: "b",
  split: { kind: "equal", participantIds: ["b"] },
  category: null,
  occurredAt: "2026-10-13T09:00:00+09:00",
});
const all = [lunch, taxi, snack];

describe("filterExpenses", () => {
  const ids = (filter: Parameters<typeof filterExpenses>[1]) =>
    filterExpenses(all, filter).map((e) => e.id);

  it("keeps everything without a filter", () => {
    expect(ids(NO_FILTER)).toEqual(["lunch", "taxi", "snack"]);
    expect(isFiltering(NO_FILTER)).toBe(false);
  });

  it("matches a member who paid or shared", () => {
    expect(ids({ ...NO_FILTER, memberId: "b" })).toEqual(["lunch", "snack"]);
    expect(ids({ ...NO_FILTER, memberId: "c" })).toEqual(["taxi"]);
  });

  it("matches a category, including uncategorized", () => {
    expect(ids({ ...NO_FILTER, category: { category: "food" } })).toEqual([
      "lunch",
    ]);
    expect(ids({ ...NO_FILTER, category: { category: null } })).toEqual([
      "snack",
    ]);
  });

  it("combines both filters", () => {
    const filter = { memberId: "b", category: { category: "food" } };
    expect(ids(filter)).toEqual(["lunch"]);
    expect(isFiltering(filter)).toBe(true);
  });
});

describe("groupByLocalDay", () => {
  const baseAmounts = new Map([
    ["lunch", 640],
    ["taxi", 900],
    ["snack", 120],
  ]);

  it("groups by local date, newest day and newest expense first", () => {
    const days = groupByLocalDay(all, baseAmounts);
    expect(days.map((d) => [d.date, d.weekday, d.totalBaseMinor])).toEqual([
      ["2026-10-13", 2, 120],
      ["2026-10-12", 1, 1540],
    ]);
    expect(days[1]?.expenses.map((e) => e.id)).toEqual(["taxi", "lunch"]);
  });

  it("uses the date where the expense happened, not the Taiwan date", () => {
    // 洛杉磯 10/12 晚上 = 臺灣 10/13 下午，仍算 10/12
    const late = makeExpenseRecord({
      id: "late",
      occurredAt: "2026-10-12T22:00:00-07:00",
    });
    expect(groupByLocalDay([late], new Map())[0]?.date).toBe("2026-10-12");
  });

  it("returns nothing for an empty list", () => {
    expect(groupByLocalDay([], baseAmounts)).toEqual([]);
  });
});
