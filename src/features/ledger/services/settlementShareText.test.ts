import { createTestDatabase } from "../../../data/db/testDatabase";
import { unwrap } from "../../../domain/ledger/testFixtures";
import {
  addExpense,
  addSettlement,
  createLedger,
  type LedgerCommandDeps,
} from "./ledgerCommands";
import { loadLedgerSummary } from "./ledgerSummary";
import { archiveMember } from "./memberCommands";
import { buildSettlementShareText } from "./settlementShareText";

// 臺灣時間 2026/10/21 早上
const NOW = new Date("2026-10-21T01:00:00.000Z");

async function setup(memberNames = ["Alice", "Bob", "Carol"]) {
  const db = await createTestDatabase();
  let seq = 0;
  const deps: LedgerCommandDeps = {
    db,
    newId: () => `id-${++seq}`,
    now: () => NOW,
  };
  const { ledger, members } = unwrap(
    await createLedger(deps, { name: "東京五日遊", memberNames }),
  );
  const ids = members.map((m) => m.id);
  const summary = async () => unwrap(await loadLedgerSummary(db, ledger.id));
  return { deps, ledgerId: ledger.id, ids, summary };
}

function dinner(
  payerId: string,
  participantIds: string[],
  amountMinor: number,
) {
  return {
    payerId,
    amountMinor,
    currency: "TWD",
    fx: null,
    split: { kind: "equal" as const, participantIds },
    title: "晚餐",
    note: null,
    category: null,
    placeName: null,
    location: null,
    occurredAt: "2026-10-20T19:00:00+08:00",
  };
}

describe("buildSettlementShareText", () => {
  it("lists the total, each share and how to settle", async () => {
    const { deps, ledgerId, ids, summary } = await setup();
    const [a, b, c] = ids as [string, string, string];
    unwrap(await addExpense(deps, ledgerId, dinner(a, [a, b, c], 3000)));
    unwrap(await addExpense(deps, ledgerId, dinner(b, [b, c], 1000)));

    expect(unwrap(buildSettlementShareText(await summary(), NOW))).toBe(
      [
        "【東京五日遊】結算",
        "總花費 TWD 4,000（2 筆消費）",
        "",
        "每人負擔",
        "Alice TWD 1,000",
        "Bob TWD 1,500",
        "Carol TWD 1,500",
        "",
        "還款方式",
        "Carol → Alice TWD 1,500",
        "Bob → Alice TWD 500",
        "",
        "2026/10/21 由旅遊記帳整理",
      ].join("\n"),
    );
  });

  it("says everyone is settled when there is no debt left", async () => {
    const { deps, ledgerId, ids, summary } = await setup(["Alice", "Bob"]);
    const [a, b] = ids as [string, string];
    unwrap(await addExpense(deps, ledgerId, dinner(a, [a, b], 200)));
    unwrap(
      await addSettlement(deps, ledgerId, {
        fromId: b,
        toId: a,
        amountMinor: 100,
        settledAt: "2026-10-20T21:00:00+08:00",
      }),
    );

    const text = unwrap(buildSettlementShareText(await summary(), NOW));
    expect(text).toContain("還款方式\n目前沒有欠款，大家都結清了");
  });

  it("leaves out archived members who owe nothing", async () => {
    const { deps, ledgerId, ids, summary } = await setup();
    const [a, b, c] = ids as [string, string, string];
    unwrap(await addExpense(deps, ledgerId, dinner(a, [a, b], 200)));
    unwrap(await archiveMember(deps, c));

    const text = unwrap(buildSettlementShareText(await summary(), NOW));
    expect(text).toContain("Alice TWD 100\nBob TWD 100\n");
    expect(text).not.toContain("Carol");
  });
});
