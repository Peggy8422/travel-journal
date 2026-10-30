import {
  handLoopPoints,
  pencilGrain,
  pencilPasses,
  ringPoints,
  seededRandom,
  seedFromString,
  stampWear,
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

describe("handLoopPoints", () => {
  const loop = { cx: 25, cy: 22, rx: 20, ry: 21 };
  const radius = (p: { x: number; y: number }) =>
    Math.hypot((p.x - loop.cx) / loop.rx, (p.y - loop.cy) / loop.ry);

  it("stays inside the ellipse", () => {
    for (const seed of [1, 2, 3, 99, 12345]) {
      for (const p of handLoopPoints({ ...loop, seed })) {
        expect(radius(p)).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });

  it("comes back around a little wider, so the ends do not meet exactly", () => {
    // 20 + 21 = 41 → 82 points for two turns; index 41 is exactly one turn later
    const points = handLoopPoints({ ...loop, seed: 4, turns: 2 });
    expect(points).toHaveLength(83);
    expect(radius(points[41])).toBeGreaterThan(radius(points[0]));
  });

  it("returns nothing for an empty ellipse", () => {
    expect(handLoopPoints({ cx: 0, cy: 0, rx: 0, ry: 5 })).toEqual([]);
  });
});

describe("ringPoints", () => {
  it("goes once around the ellipse without repeating the first point", () => {
    const points = ringPoints({ cx: 20, cy: 20, rx: 18, ry: 18 });
    expect(points).toHaveLength(36);
    expect(points[0]).toEqual({ x: 38, y: 20 });
    for (const p of points) {
      expect(Math.hypot(p.x - 20, p.y - 20)).toBeCloseTo(18, 6);
    }
  });

  it("returns nothing for an empty ellipse", () => {
    expect(ringPoints({ cx: 0, cy: 0, rx: 5, ry: 0 })).toEqual([]);
  });
});

describe("pencilPasses", () => {
  const points = handLoopPoints({ cx: 25, cy: 22, rx: 20, ry: 20, seed: 1 });

  it("draws one pass per fiber, near the line", () => {
    const passes = pencilPasses(points, { width: 2, seed: 3, fibers: 3 });
    expect(passes).toHaveLength(3);
    for (const pass of passes) {
      expect(pass.d).toMatch(/^M/);
      expect(pass.d).not.toMatch(/NaN|Infinity/);
      expect(pass.opacity).toBeLessThanOrEqual(1);
      for (const p of coordinates(pass.d)) {
        expect(Math.hypot(p.x - 25, p.y - 22)).toBeLessThanOrEqual(20 + 2);
      }
    }
  });

  it("never writes NaN, whatever the number of points", () => {
    // 14、27、48 個點時，最後一點的角度會因浮點誤差略大於 π
    for (let n = 2; n <= 200; n++) {
      const line = Array.from({ length: n }, (_, i) => ({ x: i, y: 5 }));
      for (const pass of pencilPasses(line, { seed: n })) {
        expect(pass.d).not.toMatch(/NaN|Infinity/);
      }
    }
  });

  it("closes a ring where it started", () => {
    const ring = ringPoints({ cx: 20, cy: 20, rx: 18, ry: 18 });
    for (const pass of pencilPasses(ring, { seed: 2, closed: true })) {
      const xy = coordinates(pass.d);
      expect(xy[xy.length - 1]).toEqual(xy[0]);
    }
  });

  it("is repeatable per seed", () => {
    expect(pencilPasses(points, { seed: 5 })).toEqual(
      pencilPasses(points, { seed: 5 }),
    );
  });

  it("needs at least two points", () => {
    expect(pencilPasses([{ x: 1, y: 1 }])).toEqual([]);
  });
});

describe("pencilGrain", () => {
  const line = [
    { x: 0, y: 10 },
    { x: 50, y: 10 },
    { x: 100, y: 10 },
  ];
  const dotCount = (layers: { d: string }[]) =>
    layers.reduce((n, layer) => n + (layer.d.match(/M/g)?.length ?? 0), 0);

  it("scatters dots along the line, within its width", () => {
    const layers = pencilGrain(line, { width: 2, seed: 1, perPx: 3 });
    expect(dotCount(layers)).toBe(300);
    for (const layer of layers) {
      // 每個點從圓的最左邊（cx - r, cy）起筆，後面的弧線是相對座標
      for (const [, y] of layer.d.matchAll(/M-?[\d.]+ (-?[\d.]+)/g)) {
        expect(Math.abs(Number(y) - 10)).toBeLessThanOrEqual(1.15);
      }
    }
  });

  it("also covers the way back to the start of a closed ring", () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(dotCount(pencilGrain(square, { perPx: 2 }))).toBe(60);
    expect(dotCount(pencilGrain(square, { perPx: 2, closed: true }))).toBe(80);
  });

  it("returns no layers for a path without length", () => {
    expect(pencilGrain([{ x: 0, y: 0 }])).toEqual([]);
  });
});

describe("stampWear", () => {
  it("puts the faded patches under the dots", () => {
    const [patches, dots] = stampWear({ width: 40, height: 40, seed: 2 });
    expect(patches.ink).toBeGreaterThan(dots.ink);
    expect(patches.d.match(/M/g)).toHaveLength(3);
    expect(dots.d.match(/M/g)).toHaveLength(Math.round((40 * 40 * 1.6) / 100));
  });
});
