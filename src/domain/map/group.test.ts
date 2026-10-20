import { groupByLocation } from "./group";
import type { MapPin } from "./types";

function pin(id: string, latitude: number, longitude: number): MapPin {
  return {
    kind: "expense",
    id,
    ledgerId: "ledger-1",
    title: id,
    subtitle: null,
    point: { latitude, longitude },
    occurredAt: "2026-10-12T12:00:00+09:00",
  };
}

describe("groupByLocation", () => {
  it("returns no groups without pins", () => {
    expect(groupByLocation([])).toEqual([]);
  });

  it("merges pins within the same ~10 m cell and keeps their order", () => {
    const lunch = pin("lunch", 35.69051, 139.70241);
    const dessert = pin("dessert", 35.69049, 139.70239);

    expect(groupByLocation([lunch, dessert])).toEqual([
      {
        key: "35.6905,139.7024",
        point: lunch.point,
        pins: [lunch, dessert],
      },
    ]);
  });

  it("orders groups by their first pin", () => {
    const groups = groupByLocation([
      pin("shinjuku-1", 35.6905, 139.7024),
      pin("kyoto", 35.0116, 135.7681),
      pin("shinjuku-2", 35.6905, 139.7024),
    ]);

    expect(groups.map((g) => g.pins.map((p) => p.id))).toEqual([
      ["shinjuku-1", "shinjuku-2"],
      ["kyoto"],
    ]);
  });

  it("keeps places further apart in separate groups", () => {
    expect(
      groupByLocation([
        pin("a", 35.6905, 139.7024),
        pin("b", 35.6915, 139.7024),
      ]),
    ).toHaveLength(2);
  });

  it("treats tiny values on both sides of zero as the same place", () => {
    const groups = groupByLocation([
      pin("north", 0.00001, -0.00001),
      pin("south", -0.00001, 0.00001),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("0.0000,0.0000");
  });
});
