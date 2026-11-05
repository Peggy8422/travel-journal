import { unwrap } from "../ledger/testFixtures";
import { hitSticker, strokePath, strokesBounds, thinPoints } from "./drawing";
import {
  hasInk,
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
  it("covers every drawn point plus half the width, not erasers", () => {
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
        { ...pen([[900, 900]], 50), tool: "eraser" },
      ]),
    ).toEqual({ x: 48, y: 190, width: 262, height: 212 });
    expect(strokesBounds([])).toBeNull();
  });
});

describe("hasInk", () => {
  it("does not count eraser strokes as drawing", () => {
    expect(hasInk([])).toBe(false);
    expect(hasInk([{ ...pen([[1, 1]]), tool: "eraser" }])).toBe(false);
    expect(hasInk([{ ...pen([[1, 1]]), tool: "pencil" }])).toBe(true);
  });
});

describe("hitSticker", () => {
  const sticker = (x: number, rotation = 0) => ({
    illustrationId: "a",
    x,
    y: 0.5,
    size: 0.2,
    rotation,
  });

  it("finds the topmost sticker, turning the point into the sticker's frame", () => {
    // A wide drawing: 0.2 wide, 0.1 tall
    const aspect = () => 0.5;
    const stickers = [sticker(0.5), sticker(0.55)];
    expect(hitSticker(stickers, aspect, [0.52, 0.5], 0)).toBe(1);
    expect(hitSticker(stickers, aspect, [0.42, 0.5], 0)).toBe(0);
    expect(hitSticker(stickers, aspect, [0.5, 0.58], 0)).toBeNull();
    expect(hitSticker(stickers, aspect, [0.5, 0.58], 0.05)).toBe(1);
    // Turned a quarter, the tall side is now across
    const turned = [sticker(0.5, 90)];
    expect(hitSticker(turned, aspect, [0.5, 0.58], 0)).toBe(0);
    expect(hitSticker(turned, aspect, [0.58, 0.5], 0)).toBeNull();
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
