import {
  dayNumber,
  entryHeading,
  formatDateRange,
  journalCaption,
  monthDayLabel,
  shiftDate,
  suggestEntryDate,
} from "./journalDates";

describe("entry dates", () => {
  it("counts days and moves across months", () => {
    expect(shiftDate("2025-11-30", 1)).toBe("2025-12-01");
    expect(shiftDate("2024-03-01", -1)).toBe("2024-02-29");
    expect(dayNumber("2025-11-21", "2025-11-21")).toBe(1);
    expect(dayNumber("2025-12-30", "2026-01-02")).toBe(4);
    expect(monthDayLabel("2025-11-22")).toBe("11月22日（六）");
  });

  it("falls back to the date when there is no title", () => {
    expect(entryHeading({ title: "", date: "2025-11-02" })).toBe("11月2日");
    expect(entryHeading({ title: "嵐山", date: "2025-11-02" })).toBe("嵐山");
  });

  it("suggests the next day, but not past today", () => {
    const today = "2026-11-03";
    expect(
      suggestEntryDate({ lastDate: null, firstExpenseDate: null, today }),
    ).toBe(today);
    expect(
      suggestEntryDate({
        lastDate: null,
        firstExpenseDate: "2026-03-06",
        today,
      }),
    ).toBe("2026-03-06");
    // Writing up a past trip
    expect(
      suggestEntryDate({
        lastDate: "2025-11-22",
        firstExpenseDate: null,
        today,
      }),
    ).toBe("2025-11-23");
    // A second page on the same day of the trip
    expect(
      suggestEntryDate({ lastDate: today, firstExpenseDate: null, today }),
    ).toBe(today);
    // A page already written for a later day
    expect(
      suggestEntryDate({
        lastDate: "2026-11-10",
        firstExpenseDate: null,
        today,
      }),
    ).toBe("2026-11-11");
  });
});

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
