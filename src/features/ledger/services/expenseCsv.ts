import { err, ok, type Result } from "../../../domain/common/result";
import {
  computeShares,
  toAmountInput,
  toExpense,
  toLedger,
  type LedgerError,
} from "../../../domain/ledger";
import type { LedgerSummary } from "./ledgerSummary";

/** Excel 需要 BOM 才會把 UTF-8 的中文正確顯示 */
const BOM = "﻿";
const NEWLINE = "\r\n";

/**
 * 把帳本的消費（不含已刪除）轉成 CSV，依消費時間排序。
 * 每位成員一欄，填入他在這筆消費應負擔的基準幣金額，算法與結餘相同。
 * 金額不加千分位，試算表才能直接計算。
 *
 * @param categoryLabel 分類代碼轉成顯示名稱（畫面層提供）
 */
export function buildExpensesCsv(
  summary: Pick<
    LedgerSummary,
    "ledger" | "members" | "expenses" | "expenseBaseAmounts"
  >,
  categoryLabel: (category: string | null) => string,
): Result<string, LedgerError> {
  const { ledger, members, expenses } = summary;
  const base = ledger.baseCurrency;
  const calcLedger = toLedger(ledger, members);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? id;

  const header = [
    "消費時間",
    "名稱",
    "分類",
    "付款人",
    "金額",
    "幣別",
    "匯率",
    `${base}金額`,
    ...members.map((m) => `${m.name} 分攤（${base}）`),
    "備註",
    "地點",
  ];

  const rows: string[][] = [];
  for (const expense of expenses) {
    if (expense.deletedAt !== null) continue;
    const shares = computeShares(toExpense(expense), calcLedger);
    if (!shares.ok) {
      return err({
        code: "INVALID_EXPENSE",
        expenseId: expense.id,
        cause: shares.error,
      });
    }
    const baseAmount = summary.expenseBaseAmounts.get(expense.id);
    rows.push([
      formatLocalTimestamp(expense.occurredAt),
      expense.title,
      expense.category === null ? "" : categoryLabel(expense.category),
      nameOf(expense.payerId),
      toAmountInput(expense.amountMinor, expense.currency),
      expense.currency,
      expense.fx?.rateToBase ?? "",
      baseAmount === undefined ? "" : toAmountInput(baseAmount, base),
      ...members.map((m) => {
        const share = shares.value.get(m.id);
        return share === undefined ? "" : toAmountInput(share, base);
      }),
      expense.note ?? "",
      expense.placeName ?? "",
    ]);
  }

  return ok(
    BOM +
      [header, ...rows]
        .map((row) => row.map(escapeCell).join(","))
        .join(NEWLINE) +
      NEWLINE,
  );
}

/** 依 RFC 4180 處理逗號、引號、換行；前後有空白也加引號，避免試算表吃掉 */
export function escapeCell(value: string): string {
  return /[",\r\n]|^\s|\s$/.test(value)
    ? `"${value.replace(/"/g, '""')}"`
    : value;
}

/** "2026-10-12T12:00:00+09:00" → "2026-10-12 12:00"，保留當地時間不換算 */
function formatLocalTimestamp(timestamp: string): string {
  return `${timestamp.slice(0, 10)} ${timestamp.slice(11, 16)}`;
}

/** 匯出檔名：帳本名稱去掉檔名不能用的字元，加上日期 */
export function exportFileName(
  ledgerName: string,
  date: string,
  extension: string,
): string {
  const safe = ledgerName.replace(/[\\/:*?"<>|\r\n]+/g, "_").trim() || "帳本";
  return `${safe}-${date}.${extension}`;
}
