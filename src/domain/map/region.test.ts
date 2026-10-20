import { regionForPoints } from "./region";

const at = (latitude: number, longitude: number) => ({ latitude, longitude });

describe("regionForPoints", () => {
  it("returns undefined without points", () => {
    expect(regionForPoints([])).toBeUndefined();
  });

  it("centers on a single point with the minimum span", () => {
    expect(regionForPoints([at(35.6595, 139.7005)])).toEqual({
      latitude: 35.6595,
      longitude: 139.7005,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
    expect(
      regionForPoints([at(1, 2), at(1, 2)], { minDelta: 0.5 }),
    ).toMatchObject({ latitudeDelta: 0.5, longitudeDelta: 0.5 });
  });

  it("frames all points with padding on each side", () => {
    // Taipei and Tokyo
    const region = regionForPoints([at(25, 121), at(35, 139)]);

    expect(region?.latitude).toBeCloseTo(30);
    expect(region?.longitude).toBeCloseTo(130);
    expect(region?.latitudeDelta).toBeCloseTo(14);
    expect(region?.longitudeDelta).toBeCloseTo(25.2);
  });

  it("uses the given padding ratio", () => {
    const region = regionForPoints([at(25, 121), at(35, 139)], {
      paddingRatio: 0,
    });

    expect(region?.latitudeDelta).toBeCloseTo(10);
    expect(region?.longitudeDelta).toBeCloseTo(18);
  });

  it.each([
    ["east of the antimeridian", [at(-18, 178), at(-17, -179)], 179.5],
    ["west of the antimeridian", [at(-18, 179), at(-17, -178)], -179.5],
  ])(
    "crosses the antimeridian when that is shorter (%s)",
    (_, points, center) => {
      const region = regionForPoints(points, { paddingRatio: 0 });

      expect(region?.longitude).toBeCloseTo(center);
      expect(region?.longitudeDelta).toBeCloseTo(3);
    },
  );

  it("does not wrap around when the direct span is shorter", () => {
    // Lisbon and Bangkok
    const region = regionForPoints([at(38.7, -9.1), at(13.8, 100.5)], {
      paddingRatio: 0,
    });

    expect(region?.longitude).toBeCloseTo(45.7);
    expect(region?.longitudeDelta).toBeCloseTo(109.6);
  });

  it("caps the spans at the whole globe", () => {
    const region = regionForPoints([
      at(-80, -170),
      at(80, -50),
      at(0, 50),
      at(0, 170),
    ]);

    expect(region?.latitudeDelta).toBe(180);
    expect(region?.longitudeDelta).toBe(360);
  });
});
