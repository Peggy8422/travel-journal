import {
  approachView,
  frameForPoints,
  GLOBE_HOME,
  GLOBE_MAX_ZOOM,
  globeProjection,
  orthographic,
  orthographicVector,
  sphereVector,
  toScreen,
  wrapLongitude,
} from "./globe";

const at = (latitude: number, longitude: number) => ({ latitude, longitude });
const layout = { cx: 157, radius: 138 };

describe("orthographic", () => {
  const p = globeProjection(
    { lon: GLOBE_HOME.lon, lat: GLOBE_HOME.lat, k: 1, cy: 400 },
    layout,
  );

  it("puts the view centre in the middle, facing the viewer", () => {
    const [x, y, z] = orthographic(p, GLOBE_HOME.lon, GLOBE_HOME.lat);

    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
    expect(z).toBeCloseTo(1);
    expect(toScreen(p, x, y)).toEqual({ x: 157, y: 400 });
  });

  it("places east to the right and north up", () => {
    const [east] = orthographic(p, GLOBE_HOME.lon + 10, GLOBE_HOME.lat);
    const [, north] = orthographic(p, GLOBE_HOME.lon, GLOBE_HOME.lat + 10);

    expect(east).toBeGreaterThan(0);
    expect(north).toBeGreaterThan(0);
    // Screen y grows downwards
    expect(toScreen(p, 0, north).y).toBeLessThan(400);
  });

  it("hides the far side of the globe", () => {
    const [, , z] = orthographic(p, GLOBE_HOME.lon - 180, -GLOBE_HOME.lat);

    expect(z).toBeCloseTo(-1);
  });

  it("scales with the zoom", () => {
    const zoomed = globeProjection({ lon: 0, lat: 0, k: 2, cy: 300 }, layout);

    expect(toScreen(zoomed, 1, 0)).toEqual({ x: 157 + 276, y: 300 });
  });
});

describe("frameForPoints", () => {
  it("returns null without points", () => {
    expect(frameForPoints([], 138)).toBeNull();
  });

  it("centres on a single point at the maximum zoom", () => {
    const frame = frameForPoints([at(35.68, 139.76)], 138);

    expect(frame?.lat).toBeCloseTo(35.68);
    expect(frame?.lon).toBeCloseTo(139.76);
    expect(frame?.k).toBe(GLOBE_MAX_ZOOM);
  });

  it("zooms less for points far apart", () => {
    // Tokyo and Kyoto vs Taipei and Paris
    const near = frameForPoints([at(35.68, 139.76), at(35.01, 135.77)], 138);
    const far = frameForPoints([at(25.03, 121.56), at(48.86, 2.35)], 138);

    expect(near?.k).toBeGreaterThan(far?.k ?? Infinity);
    expect(far?.k).toBeGreaterThanOrEqual(1);
    expect(near?.lon).toBeGreaterThan(135.77);
    expect(near?.lon).toBeLessThan(139.76);
  });

  it("centres across the antimeridian", () => {
    const frame = frameForPoints([at(-17, 179), at(-17, -179)], 138);

    expect(Math.abs(frame?.lon ?? 0)).toBeCloseTo(180);
  });
});

describe("approachView", () => {
  const start = { lon: 0, lat: 0, k: 1, cy: 400 };

  it("moves part of the way and keeps going", () => {
    const { view, arrived } = approachView(
      start,
      { lon: 100, lat: 20, k: 3, cy: 300 },
      0.04,
    );

    expect(arrived).toBe(false);
    expect(view.lon).toBeGreaterThan(0);
    expect(view.lon).toBeLessThan(100);
    expect(view.k).toBeGreaterThan(1);
    expect(view.cy).toBeLessThan(400);
  });

  it("turns the short way across the antimeridian", () => {
    const { view } = approachView(
      { ...start, lon: 170 },
      { ...start, lon: -170 },
      0.04,
    );

    expect(view.lon).toBeGreaterThan(170);
  });

  it("snaps to the target once close enough", () => {
    let view = start;
    let arrived = false;
    for (let i = 0; i < 200 && !arrived; i++) {
      ({ view, arrived } = approachView(
        view,
        { lon: 120, lat: 23, k: 2, cy: 320 },
        0.04,
      ));
    }

    expect(arrived).toBe(true);
    expect(view).toEqual({ lon: 120, lat: 23, k: 2, cy: 320 });
  });
});

describe("wrapLongitude", () => {
  it.each([
    [0, 0],
    [190, -170],
    [-190, 170],
    [540, -180],
    [-180, -180],
  ])("wraps %d to %d", (input, expected) => {
    expect(wrapLongitude(input)).toBeCloseTo(expected);
  });
});

describe("orthographicVector", () => {
  it("matches orthographic for the same point", () => {
    const p = globeProjection({ lon: 100, lat: 30, k: 1, cy: 0 }, layout);
    for (const [lon, lat] of [
      [121.5, 25],
      [-73.9, 40.7],
      [151.2, -33.9],
    ]) {
      const expected = orthographic(p, lon, lat);
      const actual = orthographicVector(p, ...sphereVector(lon, lat));
      actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 10));
    }
  });
});
