import {
  COVER_PALETTES,
  COVER_PATTERNS,
  COVER_STYLES,
  coverFromId,
  parseCover,
  randomCover,
  rerollCover,
} from "./cover";

/** 依序回傳給定的數字，用完再從頭 */
function sequence(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("randomCover", () => {
  it("picks one code from each list", () => {
    expect(randomCover(sequence(0, 0.99, 0.5))).toEqual({
      style: "band",
      palette: "kraft",
      pattern: "checker",
    });
  });

  it("only produces known codes", () => {
    for (let i = 0; i < 200; i++) {
      const cover = randomCover();
      expect(COVER_STYLES).toContain(cover.style);
      expect(COVER_PALETTES).toContain(cover.palette);
      expect(COVER_PATTERNS).toContain(cover.pattern);
    }
  });
});

describe("rerollCover", () => {
  const current = { style: "band", palette: "shu", pattern: "dots" } as const;

  it("changes the style or the palette", () => {
    for (let i = 0; i < 100; i++) {
      const next = rerollCover(current);
      expect(
        next.style !== current.style || next.palette !== current.palette,
      ).toBe(true);
    }
  });

  it("still changes when the random source keeps repeating the same cover", () => {
    // 0 → band、shu、dots，永遠抽到目前這一組
    const next = rerollCover(current, sequence(0));
    expect(next.palette).not.toBe(current.palette);
  });
});

describe("coverFromId", () => {
  it("gives the same cover for the same id", () => {
    expect(coverFromId("ledger-1")).toEqual(coverFromId("ledger-1"));
  });

  it("spreads different ids over different covers", () => {
    const covers = new Set(
      Array.from({ length: 30 }, (_, i) =>
        JSON.stringify(coverFromId(`ledger-${i}`)),
      ),
    );
    expect(covers.size).toBeGreaterThan(10);
  });
});

describe("parseCover", () => {
  it("reads known codes", () => {
    expect(parseCover("tape", "matcha", "waves")).toEqual({
      style: "tape",
      palette: "matcha",
      pattern: "waves",
    });
  });

  it("returns null when any code is missing or unknown", () => {
    expect(parseCover(null, null, null)).toBeNull();
    expect(parseCover("tape", "neon", "waves")).toBeNull();
    expect(parseCover("tape", "matcha", 3)).toBeNull();
  });
});
