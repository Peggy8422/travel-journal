import {
  createBotQuoteRefreshScheduler,
  REFRESH_INTERVAL_MS,
  RETRY_INTERVAL_MS,
} from "./botQuoteRefreshScheduler";
import type { RefreshBotQuoteCacheResult } from "./refreshBotQuoteCache";

const REFRESHED: RefreshBotQuoteCacheResult = {
  status: "refreshed",
  quoteDate: "2026-10-13",
  count: 19,
};
const FAILED: RefreshBotQuoteCacheResult = { status: "fetch-failed" };

function setup(results: RefreshBotQuoteCacheResult[]) {
  let time = Date.UTC(2026, 9, 13);
  const refresh = jest.fn(async () => results.shift() ?? REFRESHED);
  const onFormatChanged = jest.fn();
  const scheduler = createBotQuoteRefreshScheduler({
    refresh,
    now: () => new Date(time),
    onFormatChanged,
  });
  return {
    scheduler,
    refresh,
    onFormatChanged,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

describe("createBotQuoteRefreshScheduler", () => {
  it("refreshes on the first trigger", async () => {
    const { scheduler, refresh } = setup([REFRESHED]);
    expect(await scheduler.trigger()).toEqual({
      kind: "ran",
      result: REFRESHED,
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("waits the full interval after a successful refresh", async () => {
    const { scheduler, refresh, advance } = setup([REFRESHED, REFRESHED]);
    await scheduler.trigger();
    advance(REFRESH_INTERVAL_MS - 1);
    expect(await scheduler.trigger()).toEqual({
      kind: "skipped",
      reason: "too-soon",
    });
    advance(1);
    expect((await scheduler.trigger()).kind).toBe("ran");
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("retries sooner after a failure", async () => {
    const { scheduler, refresh, advance } = setup([FAILED, REFRESHED]);
    await scheduler.trigger();
    advance(RETRY_INTERVAL_MS - 1);
    expect((await scheduler.trigger()).kind).toBe("skipped");
    advance(1);
    expect((await scheduler.trigger()).kind).toBe("ran");
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("runs only one refresh at a time", async () => {
    let release: (value: RefreshBotQuoteCacheResult) => void = () => {};
    const refresh = jest.fn(
      () =>
        new Promise<RefreshBotQuoteCacheResult>((resolve) => {
          release = resolve;
        }),
    );
    const scheduler = createBotQuoteRefreshScheduler({
      refresh,
      now: () => new Date(0),
    });

    const first = scheduler.trigger();
    expect(await scheduler.trigger()).toEqual({
      kind: "skipped",
      reason: "in-flight",
    });
    release(REFRESHED);
    await first;
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("allows another attempt if the refresh throws unexpectedly", async () => {
    const refresh = jest
      .fn<Promise<RefreshBotQuoteCacheResult>, []>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(REFRESHED);
    const scheduler = createBotQuoteRefreshScheduler({
      refresh,
      now: () => new Date(0),
    });
    await expect(scheduler.trigger()).rejects.toThrow("boom");
    expect((await scheduler.trigger()).kind).toBe("ran");
  });

  it("reports a format change", async () => {
    const formatChanged = {
      status: "format-changed",
      error: new Error("changed"),
    } as unknown as RefreshBotQuoteCacheResult;
    const { scheduler, onFormatChanged } = setup([formatChanged]);
    await scheduler.trigger();
    expect(onFormatChanged).toHaveBeenCalledWith(formatChanged);
  });
});
