import type { BotQuote } from "../../domain/fx";
import type { CurrencyCode } from "../../domain/ledger";
import { err, ok, type Result } from "../../domain/common/result";
import {
  checkRowShape,
  parseQuoteCells,
  QUOTE_HEADER,
  splitCells,
  splitLines,
  validateHeader,
  type BotCsvError,
} from "./botCsvShared";

/** 歷史匯率 CSV 在報價欄位前多一欄「資料日期」，格式為西元 YYYYMMDD */
const HISTORY_HEADER: readonly string[] = ["資料日期", ...QUOTE_HEADER];
const COMPACT_DATE = /^(\d{4})(\d{2})(\d{2})$/;

/**
 * 解析臺銀單一幣別的歷史匯率 CSV（依 2026-10-13 下載的美金近半年檔案確認）。
 * 每列一個營業日，非營業日不會出現在檔案中。
 *
 * @param currency 預期的幣別；檔案內任何一列幣別不符都視為錯誤（例如下載到錯的檔案）
 */
export function parseBotHistoryCsv(
  text: string,
  currency: CurrencyCode,
): Result<BotQuote[], BotCsvError> {
  const [headerLine, ...rowLines] = splitLines(text);
  if (headerLine === undefined) return err({ code: "EMPTY_FILE" });

  const header = validateHeader(headerLine, HISTORY_HEADER);
  if (!header.ok) return header;
  if (rowLines.length === 0) return err({ code: "NO_ROWS" });

  const quotes: BotQuote[] = [];
  const seenDates = new Set<string>();
  for (const line of rowLines) {
    const cells = splitCells(line.text, HISTORY_HEADER.length);
    const shape = checkRowShape(cells, HISTORY_HEADER.length, line.lineNumber);
    if (!shape.ok) return shape;

    const [rawDate = "", ...quoteCells] = cells;
    const date = parseCompactDate(rawDate);
    if (date === undefined) {
      return err({
        code: "INVALID_ROW_DATE",
        lineNumber: line.lineNumber,
        value: rawDate,
      });
    }

    const quote = parseQuoteCells(quoteCells, line.lineNumber, date);
    if (!quote.ok) return quote;
    if (quote.value.currency !== currency) {
      return err({
        code: "CURRENCY_MISMATCH",
        lineNumber: line.lineNumber,
        expected: currency,
        actual: quote.value.currency,
      });
    }
    if (seenDates.has(date)) return err({ code: "DUPLICATE_DATE", date });
    seenDates.add(date);
    quotes.push(quote.value);
  }
  return ok(quotes);
}

/** 20261013 → 2026-10-13；拒絕 20260230 這類不存在的日期 */
function parseCompactDate(raw: string): string | undefined {
  const match = COMPACT_DATE.exec(raw);
  if (!match) return undefined;
  const iso = `${match[1]}-${match[2]}-${match[3]}`;
  const ms = Date.parse(`${iso}T00:00:00Z`);
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === iso
    ? iso
    : undefined;
}
