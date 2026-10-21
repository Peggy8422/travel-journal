import {
  makeExpenseRecord,
  makeLedgerRecord,
  setupLedger,
  T0,
} from "../../../data/repositories/testRecords";
import { filterPins, loadMapData } from "./mapData";

const shinjuku = { latitude: 35.6905, longitude: 139.7024 };
const kyoto = { latitude: 35.0116, longitude: 135.7681 };

/** ledger-1（東京五日遊，成員 a、b、c）之外再建 ledger-2（京都，成員 x） */
async function setupTwoLedgers() {
  const setup = await setupLedger();
  await setup.repos.ledgers.insert(
    makeLedgerRecord({
      id: "ledger-2",
      name: "京都",
      createdAt: "2026-10-02T00:00:00.000Z",
    }),
  );
  await setup.repos.members.insert({
    id: "x",
    ledgerId: "ledger-2",
    name: "Xavier",
    createdAt: T0,
  });
  return setup;
}

describe("loadMapData", () => {
  it("returns no pins when nothing has a location", async () => {
    const { db, repos } = await setupLedger();
    await repos.expenses.insert(makeExpenseRecord({ placeName: "朋友家" }));

    expect(await loadMapData(db)).toEqual({ pins: [], ledgers: [] });
  });

  it("turns located expenses into pins with amount and place name", async () => {
    const { db, repos } = await setupLedger();
    await repos.expenses.insert(
      makeExpenseRecord({
        id: "ramen",
        amountMinor: 1200,
        currency: "JPY",
        placeName: "一蘭 新宿店",
        location: shinjuku,
      }),
    );
    await repos.expenses.insert(
      makeExpenseRecord({
        id: "taxi",
        title: "計程車",
        amountMinor: 450,
        currency: "TWD",
        fx: null,
        location: kyoto,
        occurredAt: "2026-10-12T13:00:00+09:00",
      }),
    );

    const { pins } = await loadMapData(db);

    expect(pins).toEqual([
      {
        kind: "expense",
        id: "ramen",
        ledgerId: "ledger-1",
        title: "拉麵",
        subtitle: "JPY 1,200 · 一蘭 新宿店",
        point: shinjuku,
        occurredAt: "2026-10-12T12:00:00+09:00",
      },
      expect.objectContaining({ id: "taxi", subtitle: "TWD 450" }),
    ]);
  });

  it("lists only ledgers that have pins, newest ledger first", async () => {
    const { db, repos } = await setupTwoLedgers();
    await repos.ledgers.insert(
      makeLedgerRecord({ id: "empty", name: "沒有地點" }),
    );
    await repos.expenses.insert(
      makeExpenseRecord({ id: "tokyo", location: shinjuku }),
    );
    await repos.expenses.insert(
      makeExpenseRecord({
        id: "kyoto",
        ledgerId: "ledger-2",
        payerId: "x",
        split: { kind: "equal", participantIds: ["x"] },
        location: kyoto,
      }),
    );

    expect((await loadMapData(db)).ledgers).toEqual([
      { id: "ledger-2", name: "京都", kind: "shared" },
      { id: "ledger-1", name: "東京五日遊", kind: "shared" },
    ]);
  });
  it("marks the personal ledger so its pins open the personal editor", async () => {
    const { db, repos } = await setupLedger();
    await repos.ledgers.insert(
      makeLedgerRecord({ id: "personal", name: "個人", kind: "personal" }),
    );
    await repos.members.insert({
      id: "me",
      ledgerId: "personal",
      name: "我",
      createdAt: T0,
    });
    await repos.expenses.insert(
      makeExpenseRecord({
        id: "coffee",
        ledgerId: "personal",
        payerId: "me",
        split: { kind: "equal", participantIds: ["me"] },
        location: shinjuku,
      }),
    );

    expect((await loadMapData(db)).ledgers).toEqual([
      { id: "personal", name: "個人", kind: "personal" },
    ]);
  });
});

describe("filterPins", () => {
  const pins = [
    {
      kind: "expense" as const,
      id: "a",
      ledgerId: "ledger-1",
      title: "a",
      subtitle: null,
      point: shinjuku,
      occurredAt: "2026-10-12T12:00:00+09:00",
    },
    {
      kind: "expense" as const,
      id: "b",
      ledgerId: "ledger-2",
      title: "b",
      subtitle: null,
      point: kyoto,
      occurredAt: "2026-10-12T12:00:00+09:00",
    },
  ];

  it("keeps every pin for all ledgers", () => {
    expect(filterPins(pins, null)).toBe(pins);
  });

  it("keeps only the chosen ledger", () => {
    expect(filterPins(pins, "ledger-2").map((p) => p.id)).toEqual(["b"]);
  });
});
