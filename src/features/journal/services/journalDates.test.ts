import { formatDateRange, journalCaption } from "./journalDates";

describe("formatDateRange", () => {
  it("drops the repeated year", () => {
    expect(formatDateRange("2025-11-21", "2025-11-24")).toBe(
      "2025.11.21 – 11.24",
    );
  });

  it("keeps both years across new year and writes a single day once", () => {
    expect(formatDateRange("2025-12-30", "2026-01-02")).toBe(
      "2025.12.30 – 2026.01.02",
    );
    expect(formatDateRange("2025-11-21", "2025-11-21")).toBe("2025.11.21");
    expect(formatDateRange(null, null)).toBeNull();
  });
});

describe("journalCaption", () => {
  it("falls back to the month the journal was made, in Taipei time", () => {
    expect(journalCaption("2026-10-31T17:00:00.000Z", null, null)).toBe(
      "2026.11",
    );
    expect(
      journalCaption("2026-10-31T17:00:00.000Z", "2025-11-21", "2025-11-22"),
    ).toBe("2025.11.21 – 11.22");
  });
});
