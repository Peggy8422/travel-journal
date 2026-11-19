import type { RatingCriterionRecord } from "../../../domain/places";
import { placeCaption, shareRatings } from "./placeShare";

const criterion = (id: string, label: string): RatingCriterionRecord => ({
  id,
  label,
  sortOrder: 0,
  archivedAt: null,
  createdAt: "2025-11-01T00:00:00Z",
  updatedAt: "2025-11-01T00:00:00Z",
});
const criteria = [criterion("taste", "好吃"), criterion("vibe", "氣氛")];

const place = {
  name: "中村藤吉 本店",
  city: "宇治市",
  status: "visited" as const,
  ratings: [
    { criterionId: "taste", score: 5 },
    { criterionId: "gone", score: 2 },
    { criterionId: "vibe", score: 4 },
  ],
  revisit: true,
  note: "",
};

describe("place share", () => {
  it("lists scores whose criterion still exists", () => {
    expect(shareRatings(place, criteria)).toEqual([
      { label: "好吃", score: 5 },
      { label: "氣氛", score: 4 },
    ]);
  });

  it("writes the status, scores and revisit for a visited place", () => {
    expect(placeCaption(place, criteria, "甜點")).toBe(
      "中村藤吉 本店\n宇治市・甜點\n去過・好吃 5 · 氣氛 4・還想再去",
    );
  });

  it("keeps a wanted place short and adds the note", () => {
    expect(
      placeCaption(
        { ...place, status: "want", city: "", note: " 抹茶聖代 \n" },
        criteria,
        "甜點",
      ),
    ).toBe("中村藤吉 本店\n甜點\n想去\n\n抹茶聖代");
  });
});
