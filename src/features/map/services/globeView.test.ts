import type { JournalMapPin } from "../../../domain/map";
import type { MapData, MapExpense, MapLedger } from "./mapData";
import {
  clusterDescription,
  clusterLabel,
  clusterOnScreen,
  globeSheet,
  groupLedgersByYear,
} from "./globeView";

const cover = { style: "band", palette: "shu", pattern: "dots" } as const;
const ledger = (
  id: string,
  tripMonth: string,
  kind: MapLedger["kind"] = "shared",
): MapLedger => ({ id, name: id, kind, cover, tripMonth, expenseCount: 1 });

const shinjuku = { latitude: 35.6905, longitude: 139.7024 };
const kyoto = { latitude: 35.0116, longitude: 135.7681 };
const expense = (
  id: string,
  ledgerId: string,
  overrides: Partial<MapExpense> = {},
): MapExpense => ({
  kind: "expense",
  id,
  ledgerId,
  title: id,
  subtitle: null,
  point: shinjuku,
  occurredAt: "2026-10-12T12:00:00+09:00",
  category: null,
  placeName: null,
  amountMinor: 1000,
  currency: "JPY",
  baseMinor: 213,
  ...overrides,
});

const place = (
  entryId: string,
  index: number,
  ledgerId: string,
  overrides: Partial<JournalMapPin> = {},
): JournalMapPin => ({
  kind: "journal",
  id: `${entryId}:${index}`,
  entryId,
  journalId: "journal-1",
  ledgerId,
  title: entryId,
  placeName: `${entryId}-${index}`,
  point: kyoto,
  date: "2026-10-12",
  ...overrides,
});

describe("groupLedgersByYear", () => {
  it("groups shared ledgers by trip year, newest year first", () => {
    const groups = groupLedgersByYear([
      ledger("personal", "2026-10", "personal"),
      ledger("tokyo", "2026-10"),
      ledger("seoul", "2025-12"),
      ledger("osaka", "2026-03"),
    ]);

    expect(groups.map((g) => [g.year, g.ledgers.map((l) => l.id)])).toEqual([
      ["2026", ["tokyo", "osaka"]],
      ["2025", ["seoul"]],
    ]);
  });
});

describe("globeSheet", () => {
  const data: MapData = {
    ledgers: [ledger("tokyo", "2026-10"), ledger("kyoto", "2026-09")],
    pins: [
      expense("ramen", "tokyo"),
      expense("sushi", "tokyo", { baseMinor: 500 }),
      expense("temple", "kyoto", { point: kyoto }),
      expense("broken", "kyoto", { point: kyoto, baseMinor: null }),
    ],
  };

  it("lists the picked ledgers in index order with totals", () => {
    const sheet = globeSheet(data, ["kyoto", "tokyo"], null);

    expect(sheet.sections.map((s) => s.ledger.id)).toEqual(["tokyo", "kyoto"]);
    expect(sheet.expenses).toHaveLength(4);
    expect(sheet.entryCount).toBe(0);
    // Shinjuku twice and Kyoto twice
    expect(sheet.placeCount).toBe(2);
    // The expense without a base amount is left out
    expect(sheet.totalBaseMinor).toBe(213 + 500 + 213);
  });

  it("narrows the list to a place but keeps the ledger totals", () => {
    const sheet = globeSheet(data, ["kyoto", "tokyo"], ["temple"]);

    expect(sheet.sections).toEqual([
      {
        ledger: data.ledgers[1],
        rows: [{ kind: "expense", expense: data.pins[2] }],
      },
    ]);
    expect(sheet.expenses).toHaveLength(4);
  });

  it("lists a journal entry once among the expenses of its day", () => {
    const withEntries: MapData = {
      ...data,
      pins: [
        expense("lunch", "kyoto", {
          point: kyoto,
          occurredAt: "2026-10-12T12:00:00+09:00",
        }),
        expense("snack", "kyoto", {
          point: kyoto,
          occurredAt: "2026-10-13T15:00:00+09:00",
        }),
        place("day1", 0, "kyoto", { date: "2026-10-12" }),
        place("day1", 1, "kyoto", { date: "2026-10-12", point: shinjuku }),
        place("day2", 0, "kyoto", { date: "2026-10-13" }),
      ],
    };

    const sheet = globeSheet(withEntries, ["kyoto"], null);
    const rows = sheet.sections[0].rows.map((r) =>
      r.kind === "expense" ? r.expense.id : r.entry.entryId,
    );

    expect(rows).toEqual(["day1", "lunch", "day2", "snack"]);
    expect(sheet.entryCount).toBe(2);
    expect(sheet.expenses).toHaveLength(2);
    // Kyoto and Shinjuku
    expect(sheet.placeCount).toBe(2);

    const narrowed = globeSheet(withEntries, ["kyoto"], ["day1:1"]);
    expect(narrowed.sections[0].rows).toEqual([
      {
        kind: "entry",
        entry: expect.objectContaining({
          entryId: "day1",
          pins: [withEntries.pins[2], withEntries.pins[3]],
        }),
      },
    ]);
  });

  it("leaves out picked ledgers without located expenses", () => {
    const sheet = globeSheet(
      { ...data, ledgers: [...data.ledgers, ledger("empty", "2026-01")] },
      ["empty"],
      null,
    );

    expect(sheet.sections).toEqual([]);
    expect(sheet.expenses).toEqual([]);
    expect(sheet.totalBaseMinor).toBe(0);
  });
});

describe("clusterOnScreen", () => {
  it("merges points closer than the distance", () => {
    const clusters = clusterOnScreen(
      [
        { item: "a", x: 0, y: 0 },
        { item: "b", x: 10, y: 10 },
        { item: "c", x: 40, y: 0 },
      ],
      22,
    );

    expect(clusters).toEqual([
      { x: 0, y: 0, items: ["a", "b"] },
      { x: 40, y: 0, items: ["c"] },
    ]);
  });
});

describe("clusterLabel", () => {
  it("uses the place name, falling back to the title", () => {
    expect(clusterLabel([expense("a", "t", { placeName: "淺草寺" })])).toBe(
      "淺草寺",
    );
    expect(clusterLabel([expense("便利商店", "t")])).toBe("便利商店");
  });

  it("names the first place for several places", () => {
    const items = [
      expense("a", "t", { placeName: "淺草寺" }),
      expense("b", "t", { placeName: "淺草寺" }),
      expense("c", "t", { placeName: "雷門" }),
    ];

    expect(clusterLabel(items)).toBe("淺草寺 等");
    expect(clusterDescription(items)).toBe("淺草寺、雷門，3 筆消費");
  });

  it("counts journal entries apart from expenses", () => {
    const items = [
      place("e1", 0, "t", { placeName: "清水寺" }),
      place("e1", 1, "t", { placeName: "清水寺" }),
      expense("a", "t", { placeName: "清水寺" }),
    ];

    expect(clusterLabel(items)).toBe("清水寺");
    expect(clusterDescription(items)).toBe("清水寺，1 篇日記、1 筆消費");
  });
});
