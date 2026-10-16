import {
  BOT_DAILY_CSV_URL,
  BotFetchError,
  buildBotHistoryCsvUrl,
  fetchBotDailyCsv,
  fetchBotHistoryCsv,
  type FetchFn,
} from "./botRateClient";

const okResponse = (body: string) => ({
  ok: true,
  status: 200,
  text: async () => body,
});

/** 模擬一個不會自己完成、只在被 abort 時失敗的請求 */
function waitForAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    signal.addEventListener("abort", () => reject(new Error("aborted")));
  });
}

async function captureError(promise: Promise<unknown>): Promise<BotFetchError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof BotFetchError) return error;
    throw new Error(`Expected BotFetchError, got ${String(error)}`);
  }
  throw new Error("Expected the promise to reject");
}

describe("fetchBotDailyCsv", () => {
  afterEach(() => jest.useRealTimers());

  it("requests the Bank of Taiwan CSV and returns the body", async () => {
    const fetchFn = jest.fn<ReturnType<FetchFn>, Parameters<FetchFn>>(
      async () => okResponse("csv-body"),
    );
    await expect(fetchBotDailyCsv({ fetchFn })).resolves.toBe("csv-body");
    expect(fetchFn).toHaveBeenCalledWith(
      BOT_DAILY_CSV_URL,
      expect.objectContaining({ headers: { Accept: "text/csv" } }),
    );
  });

  it("reports non-2xx responses as http errors with the status", async () => {
    const fetchFn: FetchFn = async () => ({
      ok: false,
      status: 503,
      text: async () => "",
    });
    const error = await captureError(fetchBotDailyCsv({ fetchFn }));
    expect(error).toMatchObject({ kind: "http", status: 503 });
  });

  it("reports a rejected request as a network error and keeps the original error", async () => {
    const original = new TypeError("Network request failed");
    const fetchFn: FetchFn = async () => {
      throw original;
    };
    const error = await captureError(fetchBotDailyCsv({ fetchFn }));
    expect(error).toMatchObject({ kind: "network", originalError: original });
  });

  it("times out a request that never answers", async () => {
    const fetchFn: FetchFn = (_url, init) => waitForAbort(init.signal);
    const error = await captureError(
      fetchBotDailyCsv({ fetchFn, timeoutMs: 10 }),
    );
    expect(error.kind).toBe("timeout");
  });

  it("also times out while reading a slow response body", async () => {
    const fetchFn: FetchFn = async (_url, init) => ({
      ok: true,
      status: 200,
      text: () => waitForAbort(init.signal),
    });
    const error = await captureError(
      fetchBotDailyCsv({ fetchFn, timeoutMs: 10 }),
    );
    expect(error.kind).toBe("timeout");
  });

  it("clears its timer after finishing, so nothing fires later", async () => {
    jest.useFakeTimers();
    await fetchBotDailyCsv({ fetchFn: async () => okResponse("x") });
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe("fetchBotHistoryCsv", () => {
  it("uses the exact history URL confirmed from the bank website, including the uppercase L6M", () => {
    expect(buildBotHistoryCsvUrl("USD")).toBe(
      "https://rate.bot.com.tw/xrt/flcsv/0/L6M/USD",
    );
  });

  it("requests the per-currency history URL", async () => {
    const fetchFn = jest.fn<ReturnType<FetchFn>, Parameters<FetchFn>>(
      async () => okResponse("history"),
    );
    await expect(fetchBotHistoryCsv("JPY", { fetchFn })).resolves.toBe(
      "history",
    );
    expect(fetchFn.mock.calls[0]?.[0]).toBe(buildBotHistoryCsvUrl("JPY"));
  });

  it.each(["usd", "US", "USD/../x", ""])(
    "refuses to build a URL from %p",
    (currency) => {
      expect(() => buildBotHistoryCsvUrl(currency)).toThrow(RangeError);
    },
  );
});
