import { createTestDatabase } from "../../../data/db/testDatabase";
import { unwrap } from "../../../domain/ledger/testFixtures";
import {
  addExpense,
  addSettlement,
  createLedger,
  type LedgerCommandDeps,
} from "./ledgerCommands";
import { loadLedgerOverviews, tripMonthOf } from "./ledgerOverview";
import {
  makeExpenseRecord,
  makeLedgerRecord,
} from "../../../data/repositories/testRecords";
import { archiveMember } from "./memberCommands";

async function setup() {
  const db = await createTestDatabase();
  let seq = 0;
  let clock = Date.UTC(2026, 9, 12);
  const deps: LedgerCommandDeps = {
    db,
    newId: () => `id-${++seq}`,
    now: () => new Date((clock += 60_000)),
  };
  return { db, deps };
}

function meal(payerId: string, participantIds: string[], amountMinor: number) {
  return {
    payerId,
    amountMinor,
    currency: "TWD",
    fx: null,
    split: { kind: "equal" as const, participantIds },
    title: "餐",
    note: null,
    category: null,
    placeName: null,
    location: null,
    occurredAt: "2026-10-12T12:00:00+08:00",
  };
}

describe("loadLedgerOverviews", () => {
  it("summarizes totals, members and pending repayments, newest ledger first", async () => {
    const { db, deps } = await setup();
    const tokyo = unwrap(
      await createLedger(deps, {
        name: "東京",
        memberNames: ["Alice", "Bob", "Carol"],
      }),
    );
    const [a, b, c] = tokyo.members.map((m) => m.id) as [
      string,
      string,
      string,
    ];
    unwrap(await addExpense(deps, tokyo.ledger.id, meal(a, [a, b, c], 3000)));
    unwrap(await archiveMember(deps, c));

    const seoul = unwrap(
      await createLedger(deps, { name: "首爾", memberNames: ["X", "Y"] }),
    );
    const [x, y] = seoul.members.map((m) => m.id) as [string, string];
    unwrap(await addExpense(deps, seoul.ledger.id, meal(x, [x, y], 200)));
    unwrap(
      await addSettlement(deps, seoul.ledger.id, {
        fromId: y,
        toId: x,
        amountMinor: 100,
        settledAt: "2026-10-12T20:00:00+08:00",
      }),
    );

    const overviews = await loadLedgerOverviews(db);
    expect(
      overviews.map((o) =>
        o.kind === "ok"
          ? [
              o.ledger.name,
              o.activeMemberCount,
              o.expenseCount,
              o.totalBaseMinor,
              o.pendingTransferCount,
            ]
          : [o.ledger.name, "invalid"],
      ),
    ).toEqual([
      ["首爾", 2, 1, 200, 0],
      ["東京", 2, 1, 3000, 2],
    ]);
  });

  it("marks only the ledger with broken data as invalid", async () => {
    const { db, deps } = await setup();
    unwrap(await createLedger(deps, { name: "正常", memberNames: ["A"] }));
    const bad = unwrap(
      await createLedger(deps, { name: "壞掉", memberNames: ["B"] }),
    );
    const [b] = bad.members.map((m) => m.id) as [string];
    unwrap(await addExpense(deps, bad.ledger.id, meal(b, [b], 100)));
    // 直接改壞資料庫裡的分攤對象
    await db.runAsync(
      `UPDATE expenses SET split = '{"kind":"equal","participantIds":["stranger"]}'`,
    );

    const overviews = await loadLedgerOverviews(db);
    expect(overviews.map((o) => [o.ledger.name, o.kind])).toEqual([
      ["壞掉", "invalid"],
      ["正常", "ok"],
    ]);
  });
});

describe("tripMonthOf", () => {
  const ledger = makeLedgerRecord({ createdAt: "2025-10-31T17:00:00.000Z" });

  it("uses the local month of the earliest expense", () => {
    const expenses = [
      makeExpenseRecord({
        id: "late",
        occurredAt: "2025-12-02T10:00:00+09:00",
      }),
      makeExpenseRecord({
        id: "early",
        occurredAt: "2025-11-30T23:30:00+09:00",
      }),
    ];
    expect(tripMonthOf(ledger, expenses)).toBe("2025-11");
  });

  it("falls back to the Taipei month the ledger was created in", () => {
    // 10/31 17:00 UTC 是臺灣時間 11/1 凌晨
    expect(tripMonthOf(ledger, [])).toBe("2025-11");
  });

  it("prefers a month set by hand over the expenses", () => {
    const manual = { ...ledger, tripMonth: "2026-02" };
    const prepaid = makeExpenseRecord({
      occurredAt: "2025-11-15T20:00:00+08:00",
    });
    expect(tripMonthOf(manual, [prepaid])).toBe("2026-02");
    expect(tripMonthOf(manual, [])).toBe("2026-02");
  });
});
