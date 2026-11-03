import { parseJournalCover } from "./cover";
import { isLocalDate } from "./localDate";
import { isJournalMood, isJournalWeather } from "./stamps";

describe("isLocalDate", () => {
  it("accepts real calendar days", () => {
    expect(isLocalDate("2025-11-22")).toBe(true);
    expect(isLocalDate("2024-02-29")).toBe(true);
  });

  it("rejects days that do not exist and other formats", () => {
    expect(isLocalDate("2026-02-29")).toBe(false);
    expect(isLocalDate("2026-13-01")).toBe(false);
    expect(isLocalDate("2026-1-05")).toBe(false);
    expect(isLocalDate("2026-11-03T10:00:00+09:00")).toBe(false);
    expect(isLocalDate(20261103)).toBe(false);
  });
});

describe("parseJournalCover", () => {
  it("keeps a known tape and a safe photo name", () => {
    expect(parseJournalCover("matcha", "abc-1.jpg")).toEqual({
      tape: "matcha",
      photo: "abc-1.jpg",
    });
  });

  it("falls back to the first tape and drops unsafe photo names", () => {
    expect(parseJournalCover("neon", "../escape.jpg")).toEqual({
      tape: "sakura",
      photo: null,
    });
    expect(parseJournalCover(null, null)).toEqual({
      tape: "sakura",
      photo: null,
    });
  });
});

describe("stamp codes", () => {
  it("tells weather and mood codes apart", () => {
    expect(isJournalWeather("rain")).toBe(true);
    expect(isJournalWeather("happy")).toBe(false);
    expect(isJournalMood("happy")).toBe(true);
    expect(isJournalMood("thunder")).toBe(false);
  });
});
