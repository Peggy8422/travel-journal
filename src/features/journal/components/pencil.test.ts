import type { IllustrationStroke } from "../../../domain/journal";
import { pencilLook } from "./pencil";

function pencil(points: [number, number][]): IllustrationStroke {
  return { tool: "pencil", ink: "sumi", width: 10, points };
}

describe("pencilLook", () => {
  const short = pencil([
    [100, 100],
    [200, 120],
    [300, 100],
  ]);

  it("draws the same stroke the same way every time", () => {
    expect(pencilLook(pencil([...short.points] as [number, number][]))).toEqual(
      pencilLook(short),
    );
    expect(pencilLook(short).lines).toHaveLength(3);
  });

  it("keeps the grain of the start while the stroke grows", () => {
    const longer = pencil([
      ...(short.points as [number, number][]),
      [400, 140],
    ]);
    const before = pencilLook(short).specks;
    const after = pencilLook(longer).specks;
    before.forEach((layer, i) => {
      expect(after[i]!.d.startsWith(layer.d)).toBe(true);
      expect(after[i]!.d.length).toBeGreaterThan(layer.d.length);
    });
  });

  it("puts no grain on a single dot", () => {
    const look = pencilLook(pencil([[50, 50]]));
    expect(look.specks.every((layer) => layer.d === "")).toBe(true);
    expect(look.lines[0]!.d).toBe("M50 50l0.01 0");
  });
});
