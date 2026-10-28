import { toTaipeiDate } from "../../../domain/fx";
import {
  formatLocalDate,
  formatLocalDateTime,
  toLocalIsoString,
} from "./localTimestamp";

describe("toLocalIsoString", () => {
  const instant = new Date("2026-10-12T03:00:00.000Z");

  it.each([
    [540, "2026-10-12T12:00:00+09:00"],
    [480, "2026-10-12T11:00:00+08:00"],
    [0, "2026-10-12T03:00:00+00:00"],
    [-420, "2026-10-11T20:00:00-07:00"],
    [330, "2026-10-12T08:30:00+05:30"],
  ])("formats with offset %d minutes", (offset, expected) => {
    expect(toLocalIsoString(instant, offset)).toBe(expected);
  });

  it("keeps the same instant", () => {
    expect(Date.parse(toLocalIsoString(instant, -420))).toBe(instant.getTime());
  });

  it("is accepted by the timestamp validation used when saving", () => {
    expect(toTaipeiDate(toLocalIsoString(instant)).ok).toBe(true);
  });
});

describe("formatLocalDateTime", () => {
  it("shows the local time as written, without converting", () => {
    expect(formatLocalDateTime("2026-10-02T09:05:00+09:00")).toBe("10/2 09:05");
  });
});

describe("formatLocalDate", () => {
  it("shows the month, day and weekday without leading zeros", () => {
    expect(formatLocalDate("2026-10-12")).toBe("10/12（一）");
    expect(formatLocalDate("2026-01-04")).toBe("1/4（日）");
  });
});
