import {
  makeExpenseRecord,
  makeLedgerRecord,
  setupLedger,
  T0,
} from "../../../data/repositories/testRecords";
import { coverFromId } from "../../../domain/ledger";
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

    expect(await loadMapData(db)).toEqual({
      pins: [],
      ledgers: [expect.objectContaining({ id: "ledger-1" })],
    });
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
        category: null,
        placeName: "一蘭 新宿店",
        amountMinor: 1200,
        currency: "JPY",
        // 1200 × 0.2134 = 256.08
        baseMinor: 256,
      },
      expect.objectContaining({
        id: "taxi",
        subtitle: "TWD 450",
        baseMinor: 450,
      }),
    ]);
  });

  it("lists every ledger with its cover, newest trip month first", async () => {
    const { db, repos } = await setupTwoLedgers();
    await repos.ledgers.insert(
      makeLedgerRecord({
        id: "empty",
        name: "沒有地點",
        tripMonth: "2026-12",
        cover: { style: "tape", palette: "ai", pattern: "dots" },
      }),
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
      {
        id: "empty",
        name: "沒有地點",
        kind: "shared",
        cover: { style: "tape", palette: "ai", pattern: "dots" },
        tripMonth: "2026-12",
      },
      // Same trip month: the newer ledger comes first
      expect.objectContaining({ id: "ledger-2", tripMonth: "2026-10" }),
      expect.objectContaining({
        id: "ledger-1",
        tripMonth: "2026-10",
        cover: coverFromId("ledger-1"),
      }),
    ]);
  });

  it("takes the trip month from the earliest expense, located or not", async () => {
    const { db, repos } = await setupLedger();
    await repos.expenses.insert(
      makeExpenseRecord({
        id: "deposit",
        occurredAt: "2026-08-20T10:00:00+08:00",
      }),
    );
    await repos.expenses.insert(
      makeExpenseRecord({ id: "ramen", location: shinjuku }),
    );

    expect((await loadMapData(db)).ledgers).toEqual([
      expect.objectContaining({ id: "ledger-1", tripMonth: "2026-08" }),
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

    // The personal ledger comes before the shared ones
    expect((await loadMapData(db)).ledgers).toEqual([
      expect.objectContaining({ id: "personal", kind: "personal" }),
      expect.objectContaining({ id: "ledger-1", kind: "shared" }),
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
    {
      kind: "expense" as const,
      id: "c",
      ledgerId: "ledger-2",
      title: "c",
      subtitle: null,
      point: kyoto,
      occurredAt: "2026-10-13T09:00:00+09:00",
    },
  ];
  const ids = (filtered: readonly { id: string }[]) =>
    filtered.map((p) => p.id);

  it("keeps every pin for all ledgers and dates", () => {
    expect(filterPins(pins, { ledgerId: null, date: null })).toBe(pins);
  });

  it("keeps only the chosen ledger", () => {
    expect(ids(filterPins(pins, { ledgerId: "ledger-2", date: null }))).toEqual(
      ["b", "c"],
    );
  });

  it("keeps only the chosen local date", () => {
    expect(
      ids(filterPins(pins, { ledgerId: null, date: "2026-10-12" })),
    ).toEqual(["a", "b"]);
  });

  it("combines the ledger and the date", () => {
    expect(
      ids(filterPins(pins, { ledgerId: "ledger-2", date: "2026-10-12" })),
    ).toEqual(["b"]);
  });
});
