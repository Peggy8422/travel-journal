/** 臺銀牌告匯率 CSV 下載網址（2026-10-13 由網站上的下載按鈕確認） */
export const BOT_DAILY_CSV_URL = "https://rate.bot.com.tw/xrt/flcsv/0/day";

const CURRENCY_CODE = /^[A-Z]{3}$/;

/**
 * 單一幣別近半年歷史匯率 CSV 的下載網址（2026-10-13 由網站上的下載按鈕確認）。
 * 注意路徑中的 L6M 是大寫，伺服器可能區分大小寫，不要改成小寫。
 */
export function buildBotHistoryCsvUrl(currency: string): string {
  if (!CURRENCY_CODE.test(currency)) {
    throw new RangeError(
      `currency must be a 3-letter uppercase code, got ${currency}`,
    );
  }
  return `https://rate.bot.com.tw/xrt/flcsv/0/L6M/${currency}`;
}

/** 漫遊或網路不穩時不要讓使用者等太久，逾時後改用快取 */
export const DEFAULT_TIMEOUT_MS = 5000;

/** 只描述用得到的部分，讓測試能注入假的 fetch，也不依賴特定環境的 DOM 型別 */
export type FetchFn = (
  url: string,
  init: { signal: AbortSignal; headers: Record<string, string> },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export type BotFetchErrorKind = "timeout" | "network" | "http";

export class BotFetchError extends Error {
  constructor(
    readonly kind: BotFetchErrorKind,
    message: string,
    readonly status?: number,
    readonly originalError?: unknown,
  ) {
    super(message);
    this.name = "BotFetchError";
  }
}

export interface FetchBotCsvOptions {
  readonly fetchFn?: FetchFn;
  readonly timeoutMs?: number;
}

/** 下載臺銀今日牌告 CSV */
export function fetchBotDailyCsv(
  options: FetchBotCsvOptions = {},
): Promise<string> {
  return fetchBotCsv(BOT_DAILY_CSV_URL, options);
}

/** 下載臺銀單一幣別近半年歷史匯率 CSV */
export function fetchBotHistoryCsv(
  currency: string,
  options: FetchBotCsvOptions = {},
): Promise<string> {
  return fetchBotCsv(buildBotHistoryCsvUrl(currency), options);
}

/**
 * 下載 CSV 的原始文字。只負責 HTTP，不解析內容。
 * 逾時、網路錯誤、非 2xx 回應都會 throw BotFetchError；
 * 逾時涵蓋整個流程，包含讀取回應內容。
 */
async function fetchBotCsv(
  url: string,
  options: FetchBotCsvOptions,
): Promise<string> {
  const fetchFn = options.fetchFn ?? (fetch as unknown as FetchFn);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(url, {
      signal: controller.signal,
      headers: { Accept: "text/csv" },
    });
    if (!response.ok) {
      throw new BotFetchError(
        "http",
        `Bank of Taiwan responded with HTTP ${response.status}`,
        response.status,
      );
    }
    return await response.text();
  } catch (error) {
    if (error instanceof BotFetchError) throw error;
    if (controller.signal.aborted) {
      throw new BotFetchError(
        "timeout",
        `Bank of Taiwan request timed out after ${timeoutMs}ms`,
        undefined,
        error,
      );
    }
    throw new BotFetchError(
      "network",
      "Bank of Taiwan request failed",
      undefined,
      error,
    );
  } finally {
    clearTimeout(timer);
  }
}
