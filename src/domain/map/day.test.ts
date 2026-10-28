import { localDateOf, pinDates, routeOf } from "./day";
import type { MapPin } from "./types";

const shinjuku = { latitude: 35.6905, longitude: 139.7024 };
const shibuya = { latitude: 35.6595, longitude: 139.7005 };
const asakusa = { latitude: 35.7148, longitude: 139.7967 };

function pin(
  id: string,
  occurredAt: string,
  point: MapPin["point"] = shinjuku,
): MapPin {
  return {
    kind: "expense",
    id,
    ledgerId: "ledger-1",
    title: id,
    subtitle: null,
    point,
    occurredAt,
  };
}

describe("localDateOf", () => {
  it("uses the date where the expense happened, not the device time zone", () => {
    // 23:30 in Tokyo is still 10/12 there, though already 10/13 in Hawaii
    expect(localDateOf(pin("late", "2026-10-12T23:30:00+09:00"))).toBe(
      "2026-10-12",
    );
  });
});

describe("pinDates", () => {
  it("lists each date once, oldest first", () => {
    expect(
      pinDates([
        pin("c", "2026-10-14T09:00:00+09:00"),
        pin("a", "2026-10-12T09:00:00+09:00"),
        pin("b", "2026-10-12T18:00:00+09:00"),
      ]),
    ).toEqual(["2026-10-12", "2026-10-14"]);
  });

  it("returns nothing without pins", () => {
    expect(pinDates([])).toEqual([]);
  });
});

describe("routeOf", () => {
  it("connects the pins by the time they happened", () => {
    expect(
      routeOf([
        pin("dinner", "2026-10-12T19:00:00+09:00", asakusa),
        pin("breakfast", "2026-10-12T08:00:00+09:00", shinjuku),
        pin("lunch", "2026-10-12T12:00:00+09:00", shibuya),
      ]),
    ).toEqual([shinjuku, shibuya, asakusa]);
  });

  it("compares instants, not the local time text", () => {
    // 10:00 in Taipei (02:00Z) is after 09:30 in Tokyo (00:30Z)
    expect(
      routeOf([
        pin("taipei", "2026-10-12T10:00:00+08:00", shibuya),
        pin("tokyo", "2026-10-12T09:30:00+09:00", shinjuku),
      ]),
    ).toEqual([shinjuku, shibuya]);
  });

  it("keeps one point for consecutive pins at the same place", () => {
    expect(
      routeOf([
        pin("coffee", "2026-10-12T08:00:00+09:00", shinjuku),
        pin("cake", "2026-10-12T08:30:00+09:00", shinjuku),
        pin("lunch", "2026-10-12T12:00:00+09:00", shibuya),
        pin("back", "2026-10-12T18:00:00+09:00", shinjuku),
      ]),
    ).toEqual([shinjuku, shibuya, shinjuku]);
  });

  it("has no route with fewer than two places", () => {
    expect(routeOf([])).toEqual([]);
    expect(
      routeOf([
        pin("a", "2026-10-12T08:00:00+09:00"),
        pin("b", "2026-10-12T09:00:00+09:00"),
      ]),
    ).toEqual([]);
  });
});
