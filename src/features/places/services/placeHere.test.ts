import {
  makeExpenseRecord,
  setupLedger,
  T0,
} from "../../../data/repositories/testRecords";
import {
  loadHereItems,
  parsePrefill,
  prefillFromExpense,
  prefillParams,
} from "./placeHere";

const kiyomizu = { latitude: 34.9949, longitude: 135.785 };
/** About 30 m north: the same shop */
const nextDoor = { latitude: 34.99517, longitude: 135.785 };
/** About 200 m north: somewhere else */
const downTheHill = { latitude: 34.9967, longitude: 135.785 };

describe("loadHereItems", () => {
  it("lists nearby entries and expenses, newest first", async () => {
    const { db, repos } = await setupLedger();
    for (const [id, location, occurredAt, deletedAt] of [
      ["matcha", nextDoor, "2026-10-12T15:00:00+09:00", null],
      ["dango", kiyomizu, "2026-10-12T10:00:00+09:00", null],
      ["far", downTheHill, "2026-10-13T10:00:00+09:00", null],
      ["gone", kiyomizu, "2026-10-14T10:00:00+09:00", T0],
    ] as const) {
      await repos.expenses.insert(
        makeExpenseRecord({ id, title: id, location, occurredAt, deletedAt }),
      );
    }
    await repos.journals.insert({
      id: "kyoto",
      name: "京都手帳",
      ledgerId: null,
      cover: { tape: "sakura", photo: null },
      createdAt: T0,
      updatedAt: T0,
    });
    const entry = {
      journalId: "kyoto",
      body: "",
      weather: null,
      mood: null,
      photos: [],
      stickers: [],
      createdAt: T0,
      updatedAt: T0,
      deletedAt: null,
    };
    await repos.journalEntries.insert({
      ...entry,
      id: "temple",
      date: "2026-10-12",
      title: "",
      places: [
        { name: "八坂塔", location: downTheHill },
        { name: "清水寺", location: kiyomizu },
      ],
    });
    await repos.journalEntries.insert({
      ...entry,
      id: "elsewhere",
      date: "2026-10-13",
      title: "嵐山",
      places: [{ name: "竹林", location: downTheHill }],
    });

    expect(await loadHereItems(db, kiyomizu)).toEqual([
      {
        kind: "entry",
        id: "temple",
        journalId: "kyoto",
        date: "2026-10-12",
        title: "10月12日",
        journalName: "京都手帳",
      },
      expect.objectContaining({
        kind: "expense",
        id: "matcha",
        date: "2026-10-12",
        ledgerName: "東京五日遊",
      }),
      expect.objectContaining({ kind: "expense", id: "dango" }),
    ]);
  });

  it("leaves the ledger name off personal expenses", async () => {
    const { db, repos } = await setupLedger();
    await repos.ledgers.insert({
      id: "me",
      name: "個人",
      kind: "personal",
      baseCurrency: "TWD",
      cover: null,
      tripMonth: null,
      createdAt: T0,
      updatedAt: T0,
    });
    await repos.members.insert({
      id: "self",
      ledgerId: "me",
      name: "我",
      createdAt: T0,
    });
    await repos.expenses.insert(
      makeExpenseRecord({
        id: "coffee",
        ledgerId: "me",
        payerId: "self",
        split: { kind: "equal", participantIds: ["self"] },
        location: kiyomizu,
      }),
    );

    expect(await loadHereItems(db, kiyomizu)).toEqual([
      expect.objectContaining({ id: "coffee", ledgerName: null }),
    ]);
  });
});

describe("prefill", () => {
  it("starts from the expense's place name and category", () => {
    expect(
      prefillFromExpense({
        title: "抹茶聖代",
        placeName: "中村藤吉",
        category: "food",
        location: kiyomizu,
      }),
    ).toEqual({ name: "中村藤吉", location: kiyomizu, kind: "restaurant" });
    expect(
      prefillFromExpense({
        title: "門票",
        placeName: null,
        category: null,
        location: kiyomizu,
      }).name,
    ).toBe("門票");
  });

  it("round-trips through route params", () => {
    const prefill = {
      name: "清水寺",
      location: kiyomizu,
      kind: "sight",
    } as const;
    expect(parsePrefill(prefillParams(prefill))).toEqual(prefill);
  });

  it("ignores broken coordinates and unknown kinds", () => {
    expect(parsePrefill({})).toBeNull();
    expect(parsePrefill({ lat: "abc", lng: "135" })).toBeNull();
    expect(parsePrefill({ lat: "95", lng: "135" })).toBeNull();
    expect(parsePrefill({ lat: "35", lng: "135", kind: "onsen" })).toEqual({
      name: "",
      location: { latitude: 35, longitude: 135 },
      kind: "other",
    });
  });
});
