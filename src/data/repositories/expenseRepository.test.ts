import { StoredDataError } from "./shared";
import {
  makeExpenseRecord,
  makeLedgerRecord,
  setupLedger,
  T0,
} from "./testRecords";

describe("ExpenseRepository", () => {
  it("round-trips every field", async () => {
    const { repos } = await setupLedger();
    const expense = makeExpenseRecord({
      split: {
        kind: "exact",
        shares: [
          { memberId: "a", amountMinor: 1000 },
          { memberId: "b", amountMinor: 2000 },
        ],
      },
      note: "大盛",
      category: "food",
      placeName: "一蘭 新宿店",
      location: { latitude: 35.6905, longitude: 139.7024 },
    });
    await repos.expenses.insert(expense);
    expect(await repos.expenses.findById("e1")).toEqual(expense);
  });

  it.each([
    ["no fx (base currency)", null],
    ["manual fx", { rateToBase: "0.21", source: "manual" } as const],
    [
      "cached BOT fx",
      {
        rateToBase: "0.2134",
        source: "bot-cached",
        quoteDate: "2026-10-09",
        basis: "cash",
      } as const,
    ],
  ])("round-trips %s", async (_, fx) => {
    const { repos } = await setupLedger();
    const expense = makeExpenseRecord({
      fx,
      currency: fx ? "JPY" : "TWD",
    });
    await repos.expenses.insert(expense);
    expect((await repos.expenses.findById("e1"))?.fx).toEqual(fx);
  });

  it("orders by the actual instant, not by the local time text", async () => {
    const { repos } = await setupLedger();
    // 東京 10:00 (+09:00) 早於 臺北 09:30 (+08:00)
    await repos.expenses.insert(
      makeExpenseRecord({
        id: "taipei",
        occurredAt: "2026-10-12T09:30:00+08:00",
      }),
    );
    await repos.expenses.insert(
      makeExpenseRecord({
        id: "tokyo",
        occurredAt: "2026-10-12T10:00:00+09:00",
      }),
    );
    expect(
      (await repos.expenses.listByLedger("ledger-1")).map((e) => e.id),
    ).toEqual(["tokyo", "taipei"]);
  });

  it("rejects a timestamp without a time zone", async () => {
    const { repos } = await setupLedger();
    await expect(
      repos.expenses.insert(
        makeExpenseRecord({ occurredAt: "2026-10-12T10:00:00" }),
      ),
    ).rejects.toThrow(RangeError);
  });

  it("updates the whole expense but keeps createdAt", async () => {
    const { repos } = await setupLedger();
    await repos.expenses.insert(makeExpenseRecord());
    const edited = makeExpenseRecord({
      title: "沾麵",
      amountMinor: 1500,
      split: { kind: "equal", participantIds: ["a", "b"] },
      updatedAt: "2026-10-13T00:00:00.000Z",
      createdAt: "1999-01-01T00:00:00.000Z",
    });
    await repos.expenses.update(edited);
    expect(await repos.expenses.findById("e1")).toEqual(
      makeExpenseRecord({
        title: "沾麵",
        amountMinor: 1500,
        split: { kind: "equal", participantIds: ["a", "b"] },
        updatedAt: "2026-10-13T00:00:00.000Z",
      }),
    );
  });

  it("hides soft-deleted expenses unless asked", async () => {
    const { repos } = await setupLedger();
    await repos.expenses.insert(makeExpenseRecord({ id: "kept" }));
    await repos.expenses.insert(makeExpenseRecord({ id: "gone" }));
    await repos.expenses.softDelete("gone", "2026-10-13T00:00:00.000Z");

    expect(
      (await repos.expenses.listByLedger("ledger-1")).map((e) => e.id),
    ).toEqual(["kept"]);
    const all = await repos.expenses.listByLedger("ledger-1", {
      includeDeleted: true,
    });
    expect(all.find((e) => e.id === "gone")?.deletedAt).toBe(
      "2026-10-13T00:00:00.000Z",
    );
  });

  it("throws StoredDataError when the stored split JSON is malformed", async () => {
    const { db, repos } = await setupLedger();
    await repos.expenses.insert(makeExpenseRecord());
    await db.runAsync("UPDATE expenses SET split = ? WHERE id = 'e1'", [
      '{"kind":"percent"}',
    ]);
    await expect(repos.expenses.findById("e1")).rejects.toBeInstanceOf(
      StoredDataError,
    );
  });

  describe("database constraints", () => {
    it("rejects a payer from another ledger", async () => {
      const { repos } = await setupLedger();
      await repos.ledgers.insert({
        id: "ledger-2",
        kind: "shared",
        name: "首爾",
        baseCurrency: "TWD",
        cover: null,
        createdAt: "2026-10-01T00:00:00Z",
        updatedAt: "2026-10-01T00:00:00Z",
      });
      await repos.members.insert({
        id: "x",
        ledgerId: "ledger-2",
        name: "Xavier",
        createdAt: "2026-10-01T00:00:00Z",
      });
      await expect(
        repos.expenses.insert(makeExpenseRecord({ payerId: "x" })),
      ).rejects.toThrow(/FOREIGN KEY/);
    });

    it.each([
      ["a non-integer amount", { amountMinor: 10.5 }],
      ["a zero amount", { amountMinor: 0 }],
      ["half a location", { location: { latitude: 91, longitude: 0 } }],
    ])("rejects %s", async (_, overrides) => {
      const { repos } = await setupLedger();
      await expect(
        repos.expenses.insert(makeExpenseRecord(overrides)),
      ).rejects.toThrow(/CHECK/);
    });

    it("rejects BOT fx without quote info and invalid split JSON", async () => {
      const { db } = await setupLedger();
      const insert = (
        fxSource: string,
        quoteDate: string | null,
        split: string,
      ) =>
        db.runAsync(
          `INSERT INTO expenses (id, ledger_id, payer_id, amount_minor, currency,
             fx_rate_to_base, fx_source, fx_quote_date, fx_basis, split, title,
             occurred_at, occurred_at_ms, created_at, updated_at)
           VALUES ('x', 'ledger-1', 'a', 100, 'JPY', '0.2', ?, ?, 'spot', ?, 't',
             '2026-10-12T00:00:00Z', 0, 'now', 'now')`,
          [fxSource, quoteDate, split],
        );
      await expect(insert("bot-live", null, "{}")).rejects.toThrow(/CHECK/);
      await expect(insert("bot-live", "2026-10-12", "{")).rejects.toThrow(
        /CHECK/,
      );
    });
  });

  describe("listWithLocation", () => {
    const shinjuku = { latitude: 35.6905, longitude: 139.7024 };
    const kyoto = { latitude: 35.0116, longitude: 135.7681 };

    /** ledger-1 之外再建一本 ledger-2（成員 x） */
    async function setupTwoLedgers() {
      const setup = await setupLedger();
      await setup.repos.ledgers.insert(
        makeLedgerRecord({ id: "ledger-2", name: "京都" }),
      );
      await setup.repos.members.insert({
        id: "x",
        ledgerId: "ledger-2",
        name: "Xavier",
        createdAt: T0,
      });
      return setup;
    }

    it("returns only undeleted expenses that have a location", async () => {
      const { repos } = await setupLedger();
      await repos.expenses.insert(
        makeExpenseRecord({ id: "located", location: shinjuku }),
      );
      await repos.expenses.insert(
        makeExpenseRecord({ id: "name-only", placeName: "朋友家" }),
      );
      await repos.expenses.insert(
        makeExpenseRecord({
          id: "deleted",
          location: kyoto,
          deletedAt: T0,
        }),
      );

      const located = await repos.expenses.listWithLocation();

      expect(located.map((e) => e.id)).toEqual(["located"]);
      expect(located[0].location).toEqual(shinjuku);
    });

    it("lists every ledger by default, ordered by the actual instant", async () => {
      const { repos } = await setupTwoLedgers();
      await repos.expenses.insert(
        makeExpenseRecord({
          id: "taipei",
          location: shinjuku,
          occurredAt: "2026-10-12T09:30:00+08:00",
        }),
      );
      await repos.expenses.insert(
        makeExpenseRecord({
          id: "tokyo",
          ledgerId: "ledger-2",
          payerId: "x",
          split: { kind: "equal", participantIds: ["x"] },
          location: kyoto,
          occurredAt: "2026-10-12T10:00:00+09:00",
        }),
      );

      expect(
        (await repos.expenses.listWithLocation()).map((e) => e.id),
      ).toEqual(["tokyo", "taipei"]);
    });

    it("filters by ledger when asked", async () => {
      const { repos } = await setupTwoLedgers();
      await repos.expenses.insert(
        makeExpenseRecord({ id: "mine", location: shinjuku }),
      );
      await repos.expenses.insert(
        makeExpenseRecord({
          id: "other",
          ledgerId: "ledger-2",
          payerId: "x",
          split: { kind: "equal", participantIds: ["x"] },
          location: kyoto,
        }),
      );

      expect(
        (await repos.expenses.listWithLocation({ ledgerId: "ledger-2" })).map(
          (e) => e.id,
        ),
      ).toEqual(["other"]);
    });
  });
});
