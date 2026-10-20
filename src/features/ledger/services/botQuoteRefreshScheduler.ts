import type { RefreshBotQuoteCacheResult } from "./refreshBotQuoteCache";

/** 成功更新後，這段時間內不再更新 */
export const REFRESH_INTERVAL_MS = 30 * 60 * 1000;
/** 更新失敗（多半是離線）後，這段時間內不重試，避免每次回到前景都等網路逾時 */
export const RETRY_INTERVAL_MS = 5 * 60 * 1000;

export interface BotQuoteRefreshSchedulerDeps {
  readonly refresh: () => Promise<RefreshBotQuoteCacheResult>;
  readonly now: () => Date;
  /** 臺銀改了 CSV 格式時通知，讓呼叫端記錄下來 */
  readonly onFormatChanged?: (
    result: Extract<RefreshBotQuoteCacheResult, { status: "format-changed" }>,
  ) => void;
}

export type ScheduledRefreshOutcome =
  | { readonly kind: "skipped"; readonly reason: "in-flight" | "too-soon" }
  | { readonly kind: "ran"; readonly result: RefreshBotQuoteCacheResult };

/**
 * 控制匯率快取的更新頻率。App 啟動與每次回到前景都呼叫 trigger()，
 * 由這裡決定實際要不要連線：同時只跑一次，並依上次結果決定間隔。
 */
export function createBotQuoteRefreshScheduler(
  deps: BotQuoteRefreshSchedulerDeps,
) {
  let inFlight = false;
  let nextAllowedAt = -Infinity;

  async function trigger(): Promise<ScheduledRefreshOutcome> {
    if (inFlight) return { kind: "skipped", reason: "in-flight" };
    if (deps.now().getTime() < nextAllowedAt) {
      return { kind: "skipped", reason: "too-soon" };
    }

    inFlight = true;
    try {
      const result = await deps.refresh();
      const interval =
        result.status === "refreshed" ? REFRESH_INTERVAL_MS : RETRY_INTERVAL_MS;
      nextAllowedAt = deps.now().getTime() + interval;
      if (result.status === "format-changed") deps.onFormatChanged?.(result);
      return { kind: "ran", result };
    } finally {
      inFlight = false;
    }
  }

  return { trigger };
}
