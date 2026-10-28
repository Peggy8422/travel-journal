import { makeLedgerRecord } from "../../../data/repositories/testRecords";
import type { LedgerOverview } from "./ledgerOverview";
import {
  applyShelfFilter,
  groupShelf,
  NO_SHELF_FILTER,
  shelfMonths,
  shelfYears,
} from "./ledgerShelf";

function overview(id: string, tripMonth: string): LedgerOverview {
  return { kind: "invalid", ledger: makeLedgerRecord({ id }), tripMonth };
}

// 依建立時間由新到舊（和帳本列表一樣）
const shelf = [
  overview("huadong", "2026-10"),
  overview("okinawa", "2026-07"),
  overview("seoul", "2026-03"),
  overview("kyoto", "2025-11"),
  overview("kyoto-again", "2025-11"),
  overview("europe", "2025-06"),
];
const ids = (list: readonly LedgerOverview[]) => list.map((o) => o.ledger.id);

describe("shelfYears", () => {
  it("lists years that have ledgers, newest first", () => {
    expect(shelfYears(shelf)).toEqual(["2026", "2025"]);
  });
});

describe("shelfMonths", () => {
  it("lists months with ledgers in the chosen year", () => {
    expect(shelfMonths(shelf, "2025")).toEqual([6, 11]);
  });

  it("combines every year when no year is chosen", () => {
    expect(shelfMonths(shelf, null)).toEqual([3, 6, 7, 10, 11]);
  });
});

describe("applyShelfFilter", () => {
  it("keeps everything without a filter", () => {
    expect(applyShelfFilter(shelf, NO_SHELF_FILTER)).toHaveLength(6);
  });

  it("filters by year and month", () => {
    expect(ids(applyShelfFilter(shelf, { year: "2025", month: 11 }))).toEqual([
      "kyoto",
      "kyoto-again",
    ]);
    expect(ids(applyShelfFilter(shelf, { year: "2026", month: 11 }))).toEqual(
      [],
    );
  });

  it("matches a month across years when no year is chosen", () => {
    expect(ids(applyShelfFilter(shelf, { year: null, month: 7 }))).toEqual([
      "okinawa",
    ]);
  });
});

describe("groupShelf", () => {
  it("groups by trip month, newest month first, keeping the list order inside", () => {
    expect(groupShelf(shelf).map((g) => [g.month, ids(g.overviews)])).toEqual([
      ["2026-10", ["huadong"]],
      ["2026-07", ["okinawa"]],
      ["2026-03", ["seoul"]],
      ["2025-11", ["kyoto", "kyoto-again"]],
      ["2025-06", ["europe"]],
    ]);
  });
});
