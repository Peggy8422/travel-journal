import { globeProjection } from "../../../domain/map";
import {
  graticuleLines,
  linePath,
  parseRing,
  ringPath,
  toSphere,
} from "./globeDrawing";
import { LAKE_RINGS, LAND_RINGS } from "./worldOutline";

const layout = { cx: 100, radius: 100 };
const facing = (lon: number, lat = 0) =>
  globeProjection({ lon, lat, k: 1, cy: 100 }, layout);

/** "M1 2L3 4Z" 裡的所有座標 */
function coordinates(d: string): number[][] {
  return [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [
    Number(m[1]),
    Number(m[2]),
  ]);
}

describe("parseRing", () => {
  it("adds points between far-apart corners", () => {
    // The closing edge back to the first corner is filled in too
    expect(parseRing("0,0 5,0 5,1", 2.5)).toEqual([
      0, 0, 2.5, 0, 5, 0, 5, 1, 2.5, 0.5,
    ]);
  });

  it("keeps close points as they are", () => {
    expect(parseRing("1,2 2,2 2,3")).toEqual([1, 2, 2, 2, 2, 3]);
  });

  it("parses every outline in the world data", () => {
    for (const ring of [...LAND_RINGS, ...LAKE_RINGS]) {
      const flat = parseRing(ring);
      expect(flat.length % 2).toBe(0);
      expect(flat.every(Number.isFinite)).toBe(true);
    }
  });
});

describe("ringPath", () => {
  const square = toSphere(parseRing("-10,-10 10,-10 10,10 -10,10"));

  it("draws a ring facing the viewer without clipping", () => {
    const d = ringPath(square, facing(0));

    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect(d).not.toContain("NaN");
  });

  it("draws nothing for a ring on the far side", () => {
    expect(ringPath(square, facing(180))).toBe("");
  });

  it("keeps a ring across the horizon inside the globe outline", () => {
    const d = ringPath(square, facing(95));

    expect(d).not.toBe("");
    for (const [x, y] of coordinates(d)) {
      expect(Math.hypot(x - 100, y - 100)).toBeLessThanOrEqual(100.1);
    }
  });

  it("projects the whole world from any angle without NaN", () => {
    const rings = LAND_RINGS.map((r) => toSphere(parseRing(r)));
    for (const lon of [-180, -120, -60, 0, 60, 120.97]) {
      for (const lat of [-60, 0, 23.7, 75]) {
        const p = globeProjection({ lon, lat, k: 1, cy: 100 }, layout);
        const d = rings.map((r) => ringPath(r, p)).join("");
        expect(d).not.toContain("NaN");
        expect(d.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("linePath", () => {
  it("draws only the visible part of a line", () => {
    const equator = toSphere(graticuleLines().at(-3) ?? []);
    const d = linePath(equator, facing(0));

    for (const [x] of coordinates(d)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(200);
    }
    // The equator through the centre spans the full width
    expect(d.split("M").filter(Boolean)).toHaveLength(1);
  });

  it("draws nothing for a line entirely behind the globe", () => {
    expect(linePath(toSphere([180, -10, 180, 0, 180, 10]), facing(0))).toBe("");
  });
});
