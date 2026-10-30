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
): MapLedger => ({ id, name: id, kind, cover, tripMonth });

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
    // Shinjuku twice and Kyoto twice
    expect(sheet.placeCount).toBe(2);
    // The expense without a base amount is left out
    expect(sheet.totalBaseMinor).toBe(213 + 500 + 213);
  });

  it("narrows the list to a place but keeps the ledger totals", () => {
    const sheet = globeSheet(data, ["kyoto", "tokyo"], ["temple"]);

    expect(sheet.sections).toEqual([
      { ledger: data.ledgers[1], expenses: [data.pins[2]] },
    ]);
    expect(sheet.expenses).toHaveLength(4);
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
});
