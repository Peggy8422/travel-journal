import type { JournalEntryRecord } from "../../../domain/journal";
import {
  RECAP_DAY_LIMIT,
  recapCaption,
  recapDays,
  recapStats,
  tabWindowStart,
} from "./shareRecap";

let seq = 0;
function entry(
  date: string,
  extra: Partial<JournalEntryRecord> = {},
): JournalEntryRecord {
  seq += 1;
  return {
    id: `e${seq}`,
    journalId: "j1",
    date,
    title: "",
    body: "",
    weather: null,
    mood: null,
    photos: [],
    places: [],
    stickers: [],
    createdAt: `2025-12-01T00:00:${String(seq).padStart(2, "0")}Z`,
    updatedAt: "2025-12-01T00:00:00Z",
    deletedAt: null,
    ...extra,
  };
}

const at = (name: string) => ({
  name,
  location: { latitude: 35, longitude: 135.7 },
});

describe("recap days", () => {
  it("makes one card per day from the first entry, in date order", () => {
    const late = entry("2025-11-23", { title: "嵐山" });
    const first = entry("2025-11-21", { title: "抵達" });
    const second = entry("2025-11-21", { title: "晚餐", photos: ["p.jpg"] });
    const days = recapDays([late, first, second]);
    expect(days.map((d) => [d.dayNumber, d.entry.title, d.photo])).toEqual([
      // The first entry has no photo, so the day borrows the next one's
      [1, "抵達", "p.jpg"],
      [3, "嵐山", null],
    ]);
  });

  it("stops at the carousel limit", () => {
    const entries = Array.from({ length: 25 }, (_, i) =>
      entry(`2025-07-${String(i + 1).padStart(2, "0")}`),
    );
    expect(recapDays(entries)).toHaveLength(RECAP_DAY_LIMIT);
    expect(recapDays([])).toEqual([]);
  });
});

describe("recap stats", () => {
  it("counts the trip span, entries and distinct places", () => {
    const stats = recapStats([
      entry("2025-11-24", { places: [at("錦市場")] }),
      entry("2025-11-21", { places: [at("伏見稻荷"), at("錦市場")] }),
    ]);
    expect(stats).toEqual({ days: 4, entries: 2, places: 2 });
    expect(recapCaption("京都賞楓之旅", "2025.11.21 – 11.24", stats)).toBe(
      "京都賞楓之旅\n2025.11.21 – 11.24\n4 天・2 篇日記・2 個地方",
    );
  });

  it("leaves out places when there are none", () => {
    const stats = recapStats([entry("2025-11-21")]);
    expect(recapCaption("小旅行", "2025.11.21", stats)).toBe(
      "小旅行\n2025.11.21\n1 天・1 篇日記",
    );
  });
});

describe("day tabs", () => {
  it("keeps the current day near the middle", () => {
    expect(tabWindowStart(4, 2, 5)).toBe(0);
    expect(tabWindowStart(10, 0, 5)).toBe(0);
    expect(tabWindowStart(10, 5, 5)).toBe(3);
    expect(tabWindowStart(10, 9, 5)).toBe(5);
  });
});
