import { err, ok, type Result } from "../../../domain/common/result";
import { toTaipeiDate } from "../../../domain/fx";
import {
  computeLedgerStats,
  formatMinorAmount,
  toLedger,
  type LedgerError,
} from "../../../domain/ledger";
import type { LedgerSummary } from "./ledgerSummary";

/**
 * 把帳本的結算結果整理成可以直接貼到 LINE 群組的文字：
 * 總花費、每人負擔、還款方式。金額與結餘、統計頁使用同一套計算。
 * 已封存且沒有任何負擔的成員不列出。
 */
export function buildSettlementShareText(
  summary: Pick<LedgerSummary, "ledger" | "members" | "expenses" | "transfers">,
  now: Date,
): Result<string, LedgerError> {
  const { ledger, members, expenses, transfers } = summary;
  const base = ledger.baseCurrency;
  const money = (minor: number) => `${base} ${formatMinorAmount(minor, base)}`;
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "?";

  const stats = computeLedgerStats(toLedger(ledger, members), expenses);
  if (!stats.ok) return err(stats.error);
  const activeExpenseCount = expenses.filter(
    (e) => e.deletedAt === null,
  ).length;

  const lines = [
    `【${ledger.name}】結算`,
    `總花費 ${money(stats.value.totalMinor)}（${activeExpenseCount} 筆消費）`,
    "",
    "每人負擔",
  ];
  for (const member of stats.value.members) {
    const record = members.find((m) => m.id === member.memberId);
    if (record?.archivedAt && member.shareMinor === 0) continue;
    lines.push(`${nameOf(member.memberId)} ${money(member.shareMinor)}`);
  }

  lines.push("", "還款方式");
  if (transfers.length === 0) {
    lines.push("目前沒有欠款，大家都結清了");
  } else {
    for (const t of transfers) {
      lines.push(
        `${nameOf(t.fromId)} → ${nameOf(t.toId)} ${money(t.amountMinor)}`,
      );
    }
  }

  const date = toTaipeiDate(now.toISOString());
  if (date.ok) {
    lines.push("", `${date.value.replace(/-/g, "/")} 由旅遊記帳整理`);
  }
  return ok(lines.join("\n"));
}
