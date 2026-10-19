import type { BotQuote, BotQuoteCache } from "../../domain/fx";
import type { SqlExecutor } from "../db/sqlDatabase";

interface BotQuoteRow {
  currency: string;
  quote_date: string;
  cash_buy: string | null;
  cash_sell: string | null;
  spot_buy: string | null;
  spot_sell: string | null;
}

/** BotQuoteCache 的 SQLite 實作。now 用來記錄寫入時間 */
export function createBotQuoteCacheRepository(
  db: SqlExecutor,
  now: () => Date,
): BotQuoteCache {
  return {
    async findLatestOnOrBefore(currency, date) {
      const row = await db.getFirstAsync<BotQuoteRow>(
        `SELECT * FROM bot_quotes
         WHERE currency = ? AND quote_date <= ?
         ORDER BY quote_date DESC LIMIT 1`,
        [currency, date],
      );
      return row && toQuote(row);
    },

    async save(quote) {
      await db.runAsync(
        `INSERT INTO bot_quotes
           (currency, quote_date, cash_buy, cash_sell, spot_buy, spot_sell, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (currency, quote_date) DO UPDATE SET
           cash_buy = excluded.cash_buy,
           cash_sell = excluded.cash_sell,
           spot_buy = excluded.spot_buy,
           spot_sell = excluded.spot_sell,
           fetched_at = excluded.fetched_at`,
        [
          quote.currency,
          quote.quoteDate,
          quote.cashBuy ?? null,
          quote.cashSell ?? null,
          quote.spotBuy ?? null,
          quote.spotSell ?? null,
          now().toISOString(),
        ],
      );
    },
  };
}

/** 臺銀沒提供的報價在 BotQuote 是 undefined（不是 null），沒有值的欄位直接省略 */
function toQuote(row: BotQuoteRow): BotQuote {
  return {
    currency: row.currency,
    quoteDate: row.quote_date,
    ...(row.cash_buy !== null && { cashBuy: row.cash_buy }),
    ...(row.cash_sell !== null && { cashSell: row.cash_sell }),
    ...(row.spot_buy !== null && { spotBuy: row.spot_buy }),
    ...(row.spot_sell !== null && { spotSell: row.spot_sell }),
  };
}
