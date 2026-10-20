import type { SqlExecutor } from "../../../data/db/sqlDatabase";
import { createBotQuoteSource } from "../../../data/fx/botQuoteSource";
import {
  fetchBotDailyCsv,
  fetchBotHistoryCsv,
} from "../../../data/fx/botRateClient";
import { createRepositories } from "../../../data/repositories";
import type { RefreshBotQuoteCacheDeps } from "./refreshBotQuoteCache";
import type { ResolveFxRateDeps } from "./resolveFxRate";

/** 連到臺銀與本機快取的實際相依，同時滿足查匯率與更新快取兩個流程 */
export function createBotQuoteDeps(
  db: SqlExecutor,
  now: () => Date = () => new Date(),
): ResolveFxRateDeps & RefreshBotQuoteCacheDeps {
  const fetchDailyCsv = () => fetchBotDailyCsv();
  return {
    source: createBotQuoteSource({
      fetchDailyCsv,
      fetchHistoryCsv: (currency) => fetchBotHistoryCsv(currency),
      now,
    }),
    cache: createRepositories(db, now).botQuotes,
    fetchDailyCsv,
    now,
  };
}
