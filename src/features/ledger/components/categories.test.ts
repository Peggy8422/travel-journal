import { categoryColor, categoryLabel, orderForChart } from "./categories";

const palette = {
  categorical: ["c0", "c1", "c2", "c3", "c4", "c5"],
  neutral: "gray",
};

describe("categoryLabel", () => {
  it("shows Chinese names, uncategorized, and legacy text as-is", () => {
    expect(categoryLabel("food")).toBe("餐飲");
    expect(categoryLabel(null)).toBe("未分類");
    expect(categoryLabel("宵夜")).toBe("宵夜");
  });
});

describe("orderForChart", () => {
  it("follows the category list, then legacy names, then uncategorized", () => {
    const ordered = orderForChart([
      { category: null },
      { category: "shopping" },
      { category: "宵夜" },
      { category: "food" },
      { category: "伴手禮" },
    ]);
    expect(ordered.map((c) => c.category)).toEqual([
      "food",
      "shopping",
      "伴手禮",
      "宵夜",
      null,
    ]);
  });
});

describe("categoryColor", () => {
  it("gives each listed category a fixed slot, regardless of what else is present", () => {
    expect(categoryColor("food", palette)).toBe("c0");
    expect(categoryColor("other", palette)).toBe("c5");
  });

  it("uses the neutral color for uncategorized and legacy categories", () => {
    expect(categoryColor(null, palette)).toBe("gray");
    expect(categoryColor("宵夜", palette)).toBe("gray");
  });
});
