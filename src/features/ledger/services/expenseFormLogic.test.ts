import type { ExpenseFx } from "../../../domain/ledger";
import {
  buildSplitRule,
  chooseExpenseFx,
  normalizeNote,
  previewRemaining,
  resolveOccurredAt,
} from "./expenseFormLogic";
import { unwrap, unwrapErr } from "../../../domain/ledger/testFixtures";

const botFx: ExpenseFx = {
  rateToBase: "0.2134",
  source: "bot-live",
  quoteDate: "2026-10-12",
  basis: "spot",
};
const resolved = {
  ok: true as const,
  value: {
    status: "resolved" as const,
    rate: "0.2200",
    basis: "cash" as const,
    source: "bot-cached" as const,
    quoteDate: "2026-10-10",
    cacheWriteFailed: false,
  },
};

describe("chooseExpenseFx", () => {
  const base = {
    isForeign: true,
    manualRate: null,
    storedFx: undefined,
    resolution: undefined,
  };

  it("needs no rate for the base currency, whatever else is set", () => {
    expect(
      chooseExpenseFx({ ...base, isForeign: false, manualRate: "1" }),
    ).toBeNull();
  });

  it("prefers a manual rate over everything else, trimmed", () => {
    expect(
      chooseExpenseFx({
        ...base,
        manualRate: " 0.21 ",
        storedFx: botFx,
        resolution: resolved,
      }),
    ).toEqual({ rateToBase: "0.21", source: "manual" });
  });

  it("keeps the stored rate over a fresh lookup when editing", () => {
    expect(
      chooseExpenseFx({ ...base, storedFx: botFx, resolution: resolved }),
    ).toBe(botFx);
  });

  it("uses the looked-up Bank of Taiwan rate", () => {
    expect(chooseExpenseFx({ ...base, resolution: resolved })).toEqual({
      rateToBase: "0.2200",
      source: "bot-cached",
      quoteDate: "2026-10-10",
      basis: "cash",
    });
  });

  it.each([
    ["still loading", undefined],
    [
      "the lookup failed",
      {
        ok: false as const,
        error: { code: "FUTURE_DATE" as const, date: "2026-12-01" },
      },
    ],
    [
      "manual input is required",
      {
        ok: true as const,
        value: {
          status: "manual-required" as const,
          reason: "no-cached-quote" as const,
        },
      },
    ],
  ])("is missing when %s", (_, resolution) => {
    expect(chooseExpenseFx({ ...base, resolution })).toBeUndefined();
  });
});

describe("resolveOccurredAt", () => {
  const picked = new Date("2026-10-12T03:00:00.000Z");

  it("keeps the original string when editing without touching the time", () => {
    expect(
      resolveOccurredAt("2026-10-12T12:00:00+09:00", false, picked, 480),
    ).toBe("2026-10-12T12:00:00+09:00");
  });

  it("uses the picked time with the device offset once the time is changed", () => {
    expect(
      resolveOccurredAt("2026-10-12T12:00:00+09:00", true, picked, 480),
    ).toBe("2026-10-12T11:00:00+08:00");
  });

  it("uses the picked time when adding a new expense", () => {
    expect(resolveOccurredAt(undefined, false, picked, 540)).toBe(
      "2026-10-12T12:00:00+09:00",
    );
  });
});

describe("buildSplitRule", () => {
  const order = ["a", "b", "c"];

  it("orders equal-split participants by join order", () => {
    expect(
      unwrap(
        buildSplitRule(
          { kind: "equal", participantIds: ["c", "a"] },
          order,
          "TWD",
        ),
      ),
    ).toEqual({ kind: "equal", participantIds: ["a", "c"] });
  });

  it("turns typed amounts into exact shares, skipping blanks", () => {
    expect(
      unwrap(
        buildSplitRule(
          { kind: "exact", shareTexts: { c: "1.5", a: "2", b: " " } },
          order,
          "USD",
        ),
      ),
    ).toEqual({
      kind: "exact",
      shares: [
        { memberId: "a", amountMinor: 200 },
        { memberId: "c", amountMinor: 150 },
      ],
    });
  });

  it("reports which member's amount is invalid", () => {
    expect(
      unwrapErr(
        buildSplitRule(
          { kind: "exact", shareTexts: { b: "abc" } },
          order,
          "TWD",
        ),
      ),
    ).toMatchObject({ code: "INVALID_SHARE_INPUT", memberId: "b" });
  });
});

describe("previewRemaining", () => {
  const order = ["a", "b"];

  it("shows what is left, or a negative amount when over-allocated", () => {
    expect(previewRemaining("300", { a: "100" }, order, "TWD")).toBe(200);
    expect(previewRemaining("300", { a: "100", b: "250" }, order, "TWD")).toBe(
      -50,
    );
  });

  it("shows nothing until every amount is valid", () => {
    expect(previewRemaining("", { a: "100" }, order, "TWD")).toBeUndefined();
    expect(previewRemaining("300", { a: "1.5" }, order, "TWD")).toBeUndefined();
  });
});

describe("normalizeNote", () => {
  it("trims the text and keeps line breaks inside", () => {
    expect(normalizeNote("  甜點 Bob 沒吃\n收據在 Alice 那  ")).toBe(
      "甜點 Bob 沒吃\n收據在 Alice 那",
    );
  });

  it("stores blank input as null", () => {
    expect(normalizeNote("")).toBeNull();
    expect(normalizeNote(" \n ")).toBeNull();
  });
});
