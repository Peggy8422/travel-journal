import { unwrap } from "../ledger/testFixtures";
import { hitStroke, strokePath, strokesBounds, thinPoints } from "./drawing";
import {
  ILLUSTRATION_STROKE_LIMIT,
  normalizeAngle,
  parseSticker,
  parseStrokes,
  STROKE_POINT_LIMIT,
  type IllustrationStroke,
} from "./illustration";

function pen(points: [number, number][], width = 10): IllustrationStroke {
  return { tool: "pen", ink: "sumi", width, points };
}

describe("parseStrokes", () => {
  it("keeps valid strokes and tidies values that only affect looks", () => {
    expect(
      unwrap(
        parseStrokes([
          { tool: "wash", ink: "ai", width: 60, points: [[10, 20]] },
          {
            tool: "spray",
            ink: "neon",
            width: 999.4,
            points: [
              [-5, 1200],
              [3.6, 4.4],
            ],
          },
        ]),
      ),
    ).toEqual([
      { tool: "wash", ink: "ai", width: 60, points: [[10, 20]] },
      {
        tool: "pen",
        ink: "sumi",
        width: 200,
        points: [
          [0, 1000],
          [4, 4],
        ],
      },
    ]);
  });

  it.each([
    ["not an array", { strokes: [] }],
    [
      "a stroke without points",
      [{ tool: "pen", ink: "sumi", width: 4, points: [] }],
    ],
    [
      "a bad point",
      [{ tool: "pen", ink: "sumi", width: 4, points: [[1, "2"]] }],
    ],
    [
      "a bad width",
      [{ tool: "pen", ink: "sumi", width: NaN, points: [[1, 2]] }],
    ],
    [
      "too many strokes",
      Array(ILLUSTRATION_STROKE_LIMIT + 1).fill(pen([[1, 1]])),
    ],
    [
      "too many points",
      [pen(Array(STROKE_POINT_LIMIT + 1).fill([1, 1]) as [number, number][])],
    ],
  ])("rejects %s", (_name, value) => {
    expect(parseStrokes(value).ok).toBe(false);
  });
});

describe("parseSticker", () => {
  it("clamps the placement into range", () => {
    expect(
      unwrap(
        parseSticker({
          illustrationId: "i1",
          x: 1.4,
          y: -2,
          size: 3,
          rotation: 270,
        }),
      ),
    ).toEqual({ illustrationId: "i1", x: 1, y: 0, size: 1, rotation: -90 });
  });

  it("rejects a missing illustration or a non-number", () => {
    expect(parseSticker({ x: 0, y: 0, size: 0.3, rotation: 0 }).ok).toBe(false);
    expect(
      parseSticker({
        illustrationId: "i1",
        x: 0,
        y: 0,
        size: 0.3,
        rotation: Infinity,
      }).ok,
    ).toBe(false);
  });

  it("normalizes angles to (-180, 180]", () => {
    expect([0, 180, 181, -181, 540, -720].map(normalizeAngle)).toEqual([
      0, 180, -179, 179, 180, 0,
    ]);
  });
});

describe("strokePath", () => {
  it("draws a dot, a line and a smoothed curve", () => {
    expect(strokePath([[5, 6]])).toBe("M5 6l0.01 0");
    expect(
      strokePath([
        [0, 0],
        [10, 0],
      ]),
    ).toBe("M0 0L10 0");
    expect(
      strokePath([
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ]),
    ).toBe("M0 0Q10 0 10 5Q10 10 5 10L0 10");
    expect(strokePath([])).toBe("");
  });
});

describe("strokesBounds", () => {
  it("covers every point plus half the width", () => {
    expect(
      strokesBounds([
        pen(
          [
            [100, 200],
            [300, 250],
          ],
          20,
        ),
        pen([[50, 400]], 4),
      ]),
    ).toEqual({ x: 48, y: 190, width: 262, height: 212 });
    expect(strokesBounds([])).toBeNull();
  });
});

describe("hitStroke", () => {
  const strokes = [
    pen(
      [
        [0, 0],
        [100, 0],
      ],
      10,
    ),
    pen(
      [
        [50, -50],
        [50, 50],
      ],
      10,
    ),
  ];

  it("finds the topmost stroke under the finger", () => {
    expect(hitStroke(strokes, [50, 2], 0)).toBe(1);
    expect(hitStroke(strokes, [90, 4], 0)).toBe(0);
    expect(hitStroke(strokes, [90, 12], 4)).toBeNull();
    expect(hitStroke(strokes, [90, 12], 8)).toBe(0);
    expect(hitStroke([pen([[10, 10]], 6)], [12, 12], 0)).toBe(0);
  });
});

describe("thinPoints", () => {
  it("drops points too close to the last kept one but keeps the end", () => {
    expect(
      thinPoints(
        [
          [0, 0],
          [1, 0],
          [5, 0],
          [6, 0],
          [7, 0],
        ],
        4,
      ),
    ).toEqual([
      [0, 0],
      [5, 0],
      [7, 0],
    ]);
    expect(
      thinPoints(
        [
          [0, 0],
          [1, 0],
        ],
        4,
      ),
    ).toEqual([
      [0, 0],
      [1, 0],
    ]);
    expect(thinPoints([[3, 3]], 4)).toEqual([[3, 3]]);
  });
});
