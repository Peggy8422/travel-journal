import type { BotQuote } from "../../domain/fx";
import { err, ok, type Result } from "../../domain/common/result";

/*
 * 臺銀牌告 CSV 與歷史匯率 CSV 共用的格式規則，依 2026-10-13 實際下載的檔案確認：
 * - UTF-8 含 BOM、CRLF 換行
 * - 報價欄位 21 欄，前後兩段欄名重複，以「位置」區分買入與賣出
 * - 資料列結尾多一個逗號，因此比標頭多一個空欄位
 * - 無報價以 0.00000 表示（網頁上顯示為「-」）
 */

/** 報價部分的標頭（歷史匯率 CSV 在最前面多一欄「資料日期」） */
export const QUOTE_HEADER: readonly string[] = [
  "幣別",
  "匯率",
  "現金",
  "即期",
  "遠期10天",
  "遠期30天",
  "遠期60天",
  "遠期90天",
  "遠期120天",
  "遠期150天",
  "遠期180天",
  "匯率",
  "現金",
  "即期",
  "遠期10天",
  "遠期30天",
  "遠期60天",
  "遠期90天",
  "遠期120天",
  "遠期150天",
  "遠期180天",
];

/** 以 QUOTE_HEADER 為基準的欄位位置 */
const COLUMN = {
  currency: 0,
  buyLabel: 1,
  cashBuy: 2,
  spotBuy: 3,
  sellLabel: 11,
  cashSell: 12,
  spotSell: 13,
} as const;

const QUOTE_FIELDS = ["cashBuy", "cashSell", "spotBuy", "spotSell"] as const;
type QuoteField = (typeof QUOTE_FIELDS)[number];

const BUY_LABEL = "本行買入";
const SELL_LABEL = "本行賣出";
const CURRENCY_CODE = /^[A-Z]{3}$/;
const DECIMAL = /^\d+(\.\d+)?$/;
const ZERO = /^0+(\.0+)?$/;

export type BotCsvError =
  | { readonly code: "EMPTY_FILE" }
  | { readonly code: "NO_ROWS" }
  | { readonly code: "UNEXPECTED_HEADER"; readonly header: readonly string[] }
  | {
      readonly code: "MALFORMED_ROW";
      readonly lineNumber: number;
      readonly reason: string;
    }
  | {
      readonly code: "INVALID_VALUE";
      readonly lineNumber: number;
      readonly value: string;
    }
  | { readonly code: "DUPLICATE_CURRENCY"; readonly currency: string }
  | {
      readonly code: "INVALID_ROW_DATE";
      readonly lineNumber: number;
      readonly value: string;
    }
  | { readonly code: "DUPLICATE_DATE"; readonly date: string }
  | {
      readonly code: "CURRENCY_MISMATCH";
      readonly lineNumber: number;
      readonly expected: string;
      readonly actual: string;
    };

export interface NumberedLine {
  readonly lineNumber: number;
  readonly text: string;
}

/** 去掉 BOM，同時接受 CRLF 與 LF，略過空行並保留原始行號以利除錯 */
export function splitLines(text: string): NumberedLine[] {
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line, index) => ({ lineNumber: index + 1, text: line }))
    .filter((line) => line.text.trim() !== "");
}

/** 資料列結尾的多餘逗號會產生一個空欄位，先移除再比對欄數 */
export function splitCells(line: string, expectedLength: number): string[] {
  const cells = line.split(",").map((cell) => cell.trim());
  if (cells.length === expectedLength + 1 && cells[cells.length - 1] === "") {
    cells.pop();
  }
  return cells;
}

export function validateHeader(
  line: NumberedLine,
  expected: readonly string[],
): Result<void, BotCsvError> {
  const header = splitCells(line.text, expected.length);
  const matches =
    header.length === expected.length &&
    header.every((cell, i) => cell === expected[i]);
  return matches ? ok(undefined) : err({ code: "UNEXPECTED_HEADER", header });
}

/** 檢查欄數與空欄位。臺銀以 0.00000 表示無報價、不會留空，空欄位代表某欄缺漏、整排錯位 */
export function checkRowShape(
  cells: readonly string[],
  expectedLength: number,
  lineNumber: number,
): Result<void, BotCsvError> {
  if (cells.length !== expectedLength) {
    return malformed(
      lineNumber,
      `expected ${expectedLength} columns, got ${cells.length}`,
    );
  }
  if (cells.some((cell) => cell === "")) {
    return malformed(
      lineNumber,
      "unexpected empty cell, columns may be shifted",
    );
  }
  return ok(undefined);
}

/** 解析一列中「報價部分」的欄位（對應 QUOTE_HEADER） */
export function parseQuoteCells(
  cells: readonly string[],
  lineNumber: number,
  quoteDate: string,
): Result<BotQuote, BotCsvError> {
  const currency = cells[COLUMN.currency] ?? "";
  if (!CURRENCY_CODE.test(currency))
    return malformed(lineNumber, `invalid currency code "${currency}"`);
  if (cells[COLUMN.buyLabel] !== BUY_LABEL)
    return malformed(lineNumber, `expected "${BUY_LABEL}" in buy block`);
  if (cells[COLUMN.sellLabel] !== SELL_LABEL)
    return malformed(lineNumber, `expected "${SELL_LABEL}" in sell block`);

  const parsed: { -readonly [K in QuoteField]?: string } = {};
  for (const field of QUOTE_FIELDS) {
    const value = parseQuoteValue(cells[COLUMN[field]] ?? "", lineNumber);
    if (!value.ok) return value;
    if (value.value !== undefined) parsed[field] = value.value;
  }
  return ok({ currency, quoteDate, ...parsed });
}

/** 數值保持原始字串；0 與「-」都代表臺銀沒有提供這個報價 */
function parseQuoteValue(
  raw: string,
  lineNumber: number,
): Result<string | undefined, BotCsvError> {
  if (raw === "-") return ok(undefined);
  if (!DECIMAL.test(raw))
    return err({ code: "INVALID_VALUE", lineNumber, value: raw });
  return ok(ZERO.test(raw) ? undefined : raw);
}

function malformed(lineNumber: number, reason: string) {
  return err({ code: "MALFORMED_ROW" as const, lineNumber, reason });
}
