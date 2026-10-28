import {
  seededRandom,
  seedFromString,
  wobblyEllipsePath,
  wobblyRectPath,
} from "./sketch";

/** 取出 path 裡所有座標，兩兩一組 */
function coordinates(d: string): { x: number; y: number }[] {
  const numbers = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  const pairs = [];
  for (let i = 0; i < numbers.length; i += 2) {
    pairs.push({ x: numbers[i], y: numbers[i + 1] });
  }
  return pairs;
}

describe("seededRandom", () => {
  it("repeats the same sequence for the same seed", () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("stays within [0, 1)", () => {
    const random = seededRandom(7);
    for (let i = 0; i < 1000; i++) {
      const v = random();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("seedFromString", () => {
  it("is stable and differs between ids", () => {
    expect(seedFromString("«r1»")).toBe(seedFromString("«r1»"));
    expect(seedFromString("«r1»")).not.toBe(seedFromString("«r2»"));
  });
});

describe("wobblyRectPath", () => {
  const box = {
    width: 200,
    height: 80,
    radius: 14,
    wobble: 1.2,
    strokeWidth: 1.4,
  };

  it("draws a closed outline that starts with a move", () => {
    const d = wobblyRectPath({ ...box, seed: 3 });
    expect(d.startsWith("M")).toBe(true);
    expect(d).not.toMatch(/NaN|Infinity/);
  });

  it("keeps the whole stroke inside the box", () => {
    const half = box.strokeWidth / 2;
    for (const seed of [1, 2, 3, 99, 12345]) {
      for (const p of coordinates(wobblyRectPath({ ...box, seed }))) {
        expect(p.x).toBeGreaterThanOrEqual(half - 0.05);
        expect(p.x).toBeLessThanOrEqual(box.width - half + 0.05);
        expect(p.y).toBeGreaterThanOrEqual(half - 0.05);
        expect(p.y).toBeLessThanOrEqual(box.height - half + 0.05);
      }
    }
  });

  it("is repeatable per seed and varies between seeds", () => {
    expect(wobblyRectPath({ ...box, seed: 5 })).toBe(
      wobblyRectPath({ ...box, seed: 5 }),
    );
    expect(wobblyRectPath({ ...box, seed: 5 })).not.toBe(
      wobblyRectPath({ ...box, seed: 6 }),
    );
  });

  it("clamps the radius on small boxes and gives up when there is no room", () => {
    expect(wobblyRectPath({ width: 30, height: 20, radius: 40 })).toMatch(/^M/);
    expect(wobblyRectPath({ width: 2, height: 2 })).toBe("");
  });
});

describe("wobblyEllipsePath", () => {
  it("stays near the ellipse", () => {
    const shape = { cx: 50, cy: 30, rx: 40, ry: 20, wobble: 2 };
    for (const p of coordinates(wobblyEllipsePath({ ...shape, seed: 8 }))) {
      expect(Math.abs(p.x - shape.cx)).toBeLessThanOrEqual(
        shape.rx + shape.wobble,
      );
      expect(Math.abs(p.y - shape.cy)).toBeLessThanOrEqual(
        shape.ry + shape.wobble,
      );
    }
  });

  it("returns nothing for an empty ellipse", () => {
    expect(wobblyEllipsePath({ cx: 0, cy: 0, rx: 0, ry: 10 })).toBe("");
  });
});
