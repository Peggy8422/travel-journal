import { checkTextLength, TEXT_LIMITS } from "./textLimits";

describe("checkTextLength", () => {
  it("accepts text up to the limit, counting Chinese characters as one", () => {
    expect(checkTextLength("memberName", "一二三四五六七八九十").ok).toBe(true);
    expect(
      checkTextLength("ledgerName", "x".repeat(TEXT_LIMITS.ledgerName)),
    ).toEqual({ ok: true, value: undefined });
  });

  it("rejects text over the limit with the field and the limit", () => {
    expect(checkTextLength("memberName", "一二三四五六七八九十一")).toEqual({
      ok: false,
      error: { code: "TEXT_TOO_LONG", field: "memberName", max: 10 },
    });
  });

  it("lets an empty optional field through", () => {
    expect(checkTextLength("note", null).ok).toBe(true);
  });
});
