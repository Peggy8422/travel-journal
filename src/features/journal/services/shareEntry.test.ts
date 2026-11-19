import {
  entrySharePages,
  photoCaption,
  shareCaption,
  sharePageLabel,
  sharePagePhoto,
} from "./shareEntry";

const place = (name: string) => ({
  name,
  location: { latitude: 34.97, longitude: 135.77 },
});

describe("entry share pages", () => {
  it("puts the cover first, then one page per photo", () => {
    const entry = { photos: ["a.jpg", "b.jpg", "a.jpg"] };
    const pages = entrySharePages(entry);
    expect(pages.map(sharePageLabel)).toEqual([
      "封面",
      "照片 1",
      "照片 2",
      "照片 3",
    ]);
    // A photo added twice still gets two pages with their own keys
    expect(new Set(pages.map((p) => p.key)).size).toBe(4);
    expect(pages.map((p) => sharePagePhoto(p, entry))).toEqual([
      "a.jpg",
      "a.jpg",
      "b.jpg",
      "a.jpg",
    ]);
  });

  it("has only a cover without photos", () => {
    const entry = { photos: [] };
    const pages = entrySharePages(entry);
    expect(pages).toHaveLength(1);
    expect(sharePagePhoto(pages[0]!, entry)).toBeNull();
  });

  it("writes the day and date on photo pages", () => {
    expect(photoCaption(2, "2025-11-22")).toBe("Day 2 · 11.22");
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
