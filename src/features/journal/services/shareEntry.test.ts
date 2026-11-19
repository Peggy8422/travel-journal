import {
  entrySharePages,
  photoCaption,
  shareCaption,
  sharePageLabel,
  sharePagePhotos,
  scaleBar,
  shareStickerIds,
  sketchPoints,
} from "./shareEntry";

const place = (name: string) => ({
  name,
  location: { latitude: 34.97, longitude: 135.77 },
});

describe("entry share pages", () => {
  const empty = { photos: [], body: "", places: [] };

  it("puts the cover first, then photos, text and places", () => {
    const entry = {
      photos: ["a.jpg", "b.jpg", "a.jpg"],
      body: "一早去伏見稻荷",
      places: [place("伏見稻荷大社")],
    };
    const pages = entrySharePages(entry);
    expect(pages.map(sharePageLabel)).toEqual([
      "封面",
      "照片 1",
      "照片 2",
      "照片 3",
      "文字",
      "地點",
    ]);
    // A photo added twice still gets two pages with their own keys
    expect(new Set(pages.map((p) => p.key)).size).toBe(6);
    expect(pages.map((p) => sharePagePhotos(p, entry))).toEqual([
      ["a.jpg"],
      ["a.jpg"],
      ["b.jpg"],
      ["a.jpg"],
      [],
      [],
    ]);
  });

  it("has only a cover without photos, text or places", () => {
    const pages = entrySharePages({ ...empty, body: "  \n " });
    expect(pages.map(sharePageLabel)).toEqual(["封面"]);
    expect(sharePagePhotos(pages[0]!, empty)).toEqual([]);
  });

  it("makes one story collage with up to three photos", () => {
    const entry = { ...empty, photos: ["a", "b", "c", "d"] };
    const pages = entrySharePages(entry, "story");
    expect(pages.map(sharePageLabel)).toEqual(["限動"]);
    expect(sharePagePhotos(pages[0]!, entry)).toEqual(["a", "b", "c"]);
  });

  it("writes the day and date on photo pages", () => {
    expect(photoCaption(2, "2025-11-22")).toBe("Day 2 · 11.22");
  });
});

describe("text page stickers", () => {
  it("takes the topmost distinct illustrations that still exist", () => {
    const stickers = ["a", "b", "gone", "a", "c"].map((illustrationId) => ({
      illustrationId,
    }));
    expect(shareStickerIds(stickers, { a: 1, b: 1, c: 1 })).toEqual(["c", "a"]);
    expect(shareStickerIds([], {})).toEqual([]);
  });
});

describe("route sketch", () => {
  const box = { width: 300, height: 200, padding: 20 };

  it("centres a single place", () => {
    expect(sketchPoints([place("a").location], box)).toEqual({
      points: [{ x: 150, y: 100 }],
      metersPerUnit: null,
    });
  });

  it("fits places into the box, north up and east right", () => {
    const sketch = sketchPoints(
      [
        { latitude: 35.0, longitude: 135.7 },
        { latitude: 34.9, longitude: 135.8 },
      ],
      box,
    );
    const [west, east] = sketch.points;
    // 0.1° of latitude (about 11 km) spans the 160 units between the paddings
    expect(sketch.metersPerUnit).toBeCloseTo(11_132 / 160, 0);
    // Taller than wide once longitude shrinks, so height decides the scale
    expect(west!.y).toBe(20);
    expect(east!.y).toBe(180);
    expect(west!.x).toBeLessThan(east!.x);
    expect(west!.x + east!.x).toBeCloseTo(300, 0);
  });

  it("keeps places at the same spot in the middle", () => {
    const at = { latitude: 35, longitude: 135 };
    expect(sketchPoints([at, at], box).points).toEqual([
      { x: 150, y: 100 },
      { x: 150, y: 100 },
    ]);
  });

  it("picks a round distance for the scale bar", () => {
    // About 70 m per unit: 5 km would be 72 units long
    expect(scaleBar(69.6, 90)).toEqual({ length: 71.8, label: "5 km" });
    expect(scaleBar(4, 90)).toEqual({ length: 50, label: "200 m" });
    expect(scaleBar(null, 90)).toBeNull();
    // Even 10 m does not fit
    expect(scaleBar(1, 5)).toBeNull();
  });
});

describe("share caption", () => {
  const journal = { name: "京都賞楓之旅" };

  it("lists the title, date and places", () => {
    expect(
      shareCaption({
        journal,
        dayNumber: 2,
        entry: {
          title: "千本鳥居爬到一半就放棄",
          date: "2025-11-22",
          places: [place("伏見稻荷大社"), place("錦市場")],
        },
      }),
    ).toBe(
      "京都賞楓之旅 Day 2\n千本鳥居爬到一半就放棄\n2025.11.22・伏見稻荷大社、錦市場",
    );
  });

  it("falls back to the date as the title and skips missing places", () => {
    expect(
      shareCaption({
        journal,
        dayNumber: 1,
        entry: { title: "", date: "2025-11-21", places: [] },
      }),
    ).toBe("京都賞楓之旅 Day 1\n11月21日\n2025.11.21");
  });
});
