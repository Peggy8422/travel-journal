import { createTestDatabase } from "../../../data/db/testDatabase";
import { unwrap } from "../../../domain/ledger/testFixtures";
import { buildExpensesCsv, escapeCell, exportFileName } from "./expenseCsv";
import {
  addExpense,
  createLedger,
  deleteExpense,
  type LedgerCommandDeps,
} from "./ledgerCommands";
import { loadLedgerSummary } from "./ledgerSummary";

const label = (category: string | null) =>
  category === "food" ? "餐飲" : (category ?? "");

async function setup() {
  const db = await createTestDatabase();
  let seq = 0;
  const deps: LedgerCommandDeps = {
    db,
    newId: () => `id-${++seq}`,
    now: () => new Date("2026-10-12T03:00:00.000Z"),
  };
  const { ledger, members } = unwrap(
    await createLedger(deps, { name: "東京", memberNames: ["Alice", "Bob"] }),
  );
  const [a, b] = members.map((m) => m.id) as [string, string];
  return { db, deps, ledgerId: ledger.id, a, b };
}

function rowsOf(csv: string): string[] {
  return csv.replace(/^﻿/, "").trimEnd().split("\r\n");
}

describe("buildExpensesCsv", () => {
  it("writes a header with one share column per member, and one row per expense", async () => {
    const { db, deps, ledgerId, a, b } = await setup();
    unwrap(
      await addExpense(deps, ledgerId, {
        payerId: a,
        amountMinor: 3001,
        currency: "JPY",
        fx: { rateToBase: "0.2", source: "manual" },
        split: { kind: "equal", participantIds: [a, b] },
        title: "拉麵",
        note: null,
        category: "food",
        placeName: "一蘭",
        location: null,
        occurredAt: "2026-10-12T12:00:00+09:00",
      }),
    );
    const csv = unwrap(
      buildExpensesCsv(unwrap(await loadLedgerSummary(db, ledgerId)), label),
    );

    expect(csv.startsWith("﻿")).toBe(true);
    expect(rowsOf(csv)).toEqual([
      "消費時間,名稱,分類,付款人,金額,幣別,匯率,TWD金額,Alice 分攤（TWD）,Bob 分攤（TWD）,備註,地點",
      // 3001 × 0.2 = 600.2 → 600，兩人各 300
      "2026-10-12 12:00,拉麵,餐飲,Alice,3001,JPY,0.2,600,300,300,,一蘭",
    ]);
  });

  it("leaves non-participants blank and skips deleted expenses", async () => {
    const { db, deps, ledgerId, a, b } = await setup();
    const base = {
      currency: "TWD",
      fx: null,
      note: null,
      category: null,
      placeName: null,
      location: null,
      occurredAt: "2026-10-12T12:00:00+08:00",
    };
    unwrap(
      await addExpense(deps, ledgerId, {
        ...base,
        payerId: b,
        amountMinor: 120,
        split: { kind: "exact", shares: [{ memberId: b, amountMinor: 120 }] },
        title: "咖啡",
      }),
    );
    const removed = unwrap(
      await addExpense(deps, ledgerId, {
        ...base,
        payerId: a,
        amountMinor: 999,
        split: { kind: "equal", participantIds: [a] },
        title: "刪掉的",
      }),
    );
    unwrap(await deleteExpense(deps, removed.id));

    const rows = rowsOf(
      unwrap(
        buildExpensesCsv(unwrap(await loadLedgerSummary(db, ledgerId)), label),
      ),
    );
    expect(rows.slice(1)).toEqual([
      "2026-10-12 12:00,咖啡,,Bob,120,TWD,,120,,120,,",
    ]);
  });
});

describe("escapeCell", () => {
  it.each([
    ["plain", "plain"],
    ["a,b", '"a,b"'],
    ['say "hi"', '"say ""hi"""'],
    ["line\nbreak", '"line\nbreak"'],
    [" padded", '" padded"'],
  ])("escapes %p as %p", (input, expected) => {
    expect(escapeCell(input)).toBe(expected);
  });
});

describe("exportFileName", () => {
  it("removes characters that are not allowed in file names", () => {
    expect(exportFileName("東京/大阪: 5日", "2026-10-21", "csv")).toBe(
      "東京_大阪_ 5日-2026-10-21.csv",
    );
    expect(exportFileName("  ", "2026-10-21", "json")).toBe(
      "帳本-2026-10-21.json",
    );
  });
});
