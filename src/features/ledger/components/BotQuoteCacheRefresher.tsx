import { useEffect, useMemo } from "react";
import { AppState } from "react-native";

import { useDatabase } from "../../database/DatabaseProvider";
import { createBotQuoteDeps } from "../services/botQuoteDeps";
import { createBotQuoteRefreshScheduler } from "../services/botQuoteRefreshScheduler";
import { refreshBotQuoteCache } from "../services/refreshBotQuoteCache";

/**
 * 不顯示任何畫面，只在 App 啟動與回到前景時更新臺銀匯率快取，
 * 讓出國後離線時也有「最後一次連線」的匯率可用。頻率由排程器控制。
 */
export function BotQuoteCacheRefresher() {
  const db = useDatabase();
  const scheduler = useMemo(() => {
    const deps = createBotQuoteDeps(db);
    return createBotQuoteRefreshScheduler({
      refresh: () => refreshBotQuoteCache(deps),
      now: deps.now,
      onFormatChanged: (result) =>
        console.warn("Bank of Taiwan CSV format changed", result.error),
    });
  }, [db]);

  useEffect(() => {
    const run = () => {
      scheduler.trigger().catch((error: unknown) => {
        console.warn("Failed to refresh Bank of Taiwan quotes", error);
      });
    };
    run();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") run();
    });
    return () => subscription.remove();
  }, [scheduler]);

  return null;
}
