import { findDuplicateName, sameMemberName } from "./memberNames";

describe("sameMemberName", () => {
  it("ignores surrounding spaces and letter case", () => {
    expect(sameMemberName(" Alice", "alice ")).toBe(true);
    expect(sameMemberName("小明", "小明")).toBe(true);
  });

  it("tells different names apart", () => {
    expect(sameMemberName("小明", "小美")).toBe(false);
    expect(sameMemberName("Al", "Alice")).toBe(false);
  });
});

describe("findDuplicateName", () => {
  it("returns the first name that repeats an earlier one", () => {
    expect(findDuplicateName(["我", "Bob", "小明", "bob", "小明"])).toBe("bob");
  });

  it("returns undefined when every name is different", () => {
    expect(findDuplicateName(["我", "Bob", "小明"])).toBeUndefined();
    expect(findDuplicateName([])).toBeUndefined();
  });
});
