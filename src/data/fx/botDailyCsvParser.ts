import type { BotQuote } from "../../domain/fx";
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

export type { BotCsvError } from "./botCsvShared";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 解析臺銀「牌告匯率」CSV（https://rate.bot.com.tw/xrt/flcsv/0/day）。
 * 檔案內容不含日期或掛牌時間，報價日期必須由呼叫端提供。
 * 格式與預期不符時回傳錯誤，不做猜測，因為解析錯誤不會讓程式崩潰，只會讓帳默默算錯。
 *
 * @param quoteDate 報價所屬日期（臺灣時間 YYYY-MM-DD）
 */
export function parseBotDailyCsv(
  text: string,
  quoteDate: string,
): Result<BotQuote[], BotCsvError> {
  if (!DATE_ONLY.test(quoteDate)) {
    throw new RangeError(`quoteDate must be YYYY-MM-DD, got ${quoteDate}`);
  }

  const [headerLine, ...rowLines] = splitLines(text);
  if (headerLine === undefined) return err({ code: "EMPTY_FILE" });

  const header = validateHeader(headerLine, QUOTE_HEADER);
  if (!header.ok) return header;
  if (rowLines.length === 0) return err({ code: "NO_ROWS" });

  const quotes: BotQuote[] = [];
  const seen = new Set<string>();
  for (const line of rowLines) {
    const cells = splitCells(line.text, QUOTE_HEADER.length);
    const shape = checkRowShape(cells, QUOTE_HEADER.length, line.lineNumber);
    if (!shape.ok) return shape;

    const quote = parseQuoteCells(cells, line.lineNumber, quoteDate);
    if (!quote.ok) return quote;
    if (seen.has(quote.value.currency)) {
      return err({
        code: "DUPLICATE_CURRENCY",
        currency: quote.value.currency,
      });
    }
    seen.add(quote.value.currency);
    quotes.push(quote.value);
  }
  return ok(quotes);
}
