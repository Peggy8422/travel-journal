import { computeDonutArcs, describeArc, pointOnCircle } from "./donutGeometry";

const FULL = Math.PI * 2;

describe("computeDonutArcs", () => {
  it("splits the circle by value with gaps between segments", () => {
    const arcs = computeDonutArcs(
      [
        { key: "a", value: 3 },
        { key: "b", value: 1 },
      ],
      0.1,
    );
    expect(arcs).toHaveLength(2);
    const [a, b] = arcs as [(typeof arcs)[0], (typeof arcs)[0]];
    expect(a.startAngle).toBeCloseTo(0.05);
    expect(a.endAngle).toBeCloseTo(FULL * 0.75 - 0.05);
    expect(b.startAngle).toBeCloseTo(FULL * 0.75 + 0.05);
    expect(b.endAngle).toBeCloseTo(FULL - 0.05);
  });

  it("fills the whole ring with a single segment and no gap", () => {
    expect(computeDonutArcs([{ key: "a", value: 5 }], 0.1)).toEqual([
      { key: "a", startAngle: 0, endAngle: FULL },
    ]);
  });

  it("skips zero values and returns nothing when everything is zero", () => {
    expect(
      computeDonutArcs(
        [
          { key: "a", value: 0 },
          { key: "b", value: 2 },
          { key: "c", value: 2 },
        ],
        0,
      ).map((arc) => arc.key),
    ).toEqual(["b", "c"]);
    expect(computeDonutArcs([{ key: "a", value: 0 }], 0.1)).toEqual([]);
  });

  it("keeps a tiny segment visible instead of letting the gap swallow it", () => {
    const arcs = computeDonutArcs(
      [
        { key: "big", value: 9999 },
        { key: "tiny", value: 1 },
      ],
      0.1,
    );
    const tiny = arcs.find((arc) => arc.key === "tiny")!;
    expect(tiny.endAngle).toBeGreaterThan(tiny.startAngle);
  });
});

describe("pointOnCircle", () => {
  it("starts at the top and goes clockwise", () => {
    const top = pointOnCircle(50, 50, 10, 0);
    const right = pointOnCircle(50, 50, 10, Math.PI / 2);
    expect(top.x).toBeCloseTo(50);
    expect(top.y).toBeCloseTo(40);
    expect(right.x).toBeCloseTo(60);
    expect(right.y).toBeCloseTo(50);
  });
});

describe("describeArc", () => {
  it("uses the large-arc flag only for spans over half a circle", () => {
    expect(describeArc(50, 50, 10, 0, Math.PI / 2)).toBe(
      "M 50 40 A 10 10 0 0 1 60 50",
    );
    expect(describeArc(50, 50, 10, 0, Math.PI * 1.5)).toContain(" 0 1 1 ");
  });
});
