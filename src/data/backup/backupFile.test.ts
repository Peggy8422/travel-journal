import type { LedgerBackup } from "../../domain/ledger";
import { unwrap, unwrapErr } from "../../domain/ledger/testFixtures";
import {
  makeExpenseRecord,
  makeLedgerRecord,
  makeSettlementRecord,
  T0,
} from "../repositories/testRecords";
import { BACKUP_VERSION, parseBackup, serializeBackup } from "./backupFile";

const entry: LedgerBackup = {
  ledger: makeLedgerRecord(),
  members: [
    {
      id: "a",
      ledgerId: "ledger-1",
      name: "Alice",
      sortOrder: 0,
      archivedAt: null,
      createdAt: T0,
    },
    {
      id: "b",
      ledgerId: "ledger-1",
      name: "Bob",
      sortOrder: 1,
      archivedAt: "2026-10-05T00:00:00.000Z",
      createdAt: T0,
    },
  ],
  expenses: [
    makeExpenseRecord({ split: { kind: "equal", participantIds: ["a", "b"] } }),
    makeExpenseRecord({
      id: "e2",
      currency: "TWD",
      fx: null,
      split: { kind: "exact", shares: [{ memberId: "a", amountMinor: 3000 }] },
      category: "food",
      note: "宵夜",
      placeName: "一蘭",
      location: { latitude: 35.69, longitude: 139.7 },
      deletedAt: "2026-10-13T00:00:00.000Z",
    }),
    makeExpenseRecord({
      id: "e3",
      fx: { rateToBase: "0.21", source: "manual" },
    }),
  ],
  settlements: [makeSettlementRecord({ fromId: "b", toId: "a" })],
};

const contents = { exportedAt: "2026-10-21T00:00:00.000Z", ledgers: [entry] };

/** 先序列化，再用 mutate 改壞其中一部分 */
function corrupted(mutate: (raw: Record<string, any>) => void): string {
  const raw = JSON.parse(serializeBackup(contents));
  mutate(raw);
  return JSON.stringify(raw);
}

describe("backup file", () => {
  it("round-trips every field, including deleted records", () => {
    expect(unwrap(parseBackup(serializeBackup(contents)))).toEqual(contents);
  });

  it("round-trips an empty backup", () => {
    const empty = { exportedAt: T0, ledgers: [] };
    expect(unwrap(parseBackup(serializeBackup(empty)))).toEqual(empty);
  });

  it.each([
    ["not JSON", "{"],
    ["some other JSON file", JSON.stringify({ hello: "world" })],
  ])("rejects %s", (_, text) => {
    expect(unwrapErr(parseBackup(text)).code).toBe("INVALID_BACKUP");
  });

  it("rejects a backup from a newer app version", () => {
    const text = corrupted((raw) => {
      raw.version = BACKUP_VERSION + 1;
    });
    expect(unwrapErr(parseBackup(text))).toEqual({
      code: "UNSUPPORTED_BACKUP_VERSION",
      version: BACKUP_VERSION + 1,
    });
  });

  it.each([
    [
      "a non-integer amount",
      (raw: any) => (raw.ledgers[0].expenses[0].amountMinor = 1.5),
      "expenses[0]: invalid amountMinor",
    ],
    [
      "a broken split",
      (raw: any) => (raw.ledgers[0].expenses[0].split = { kind: "percent" }),
      "expenses[0]: split",
    ],
    [
      "an unknown fx source",
      (raw: any) => (raw.ledgers[0].expenses[0].fx.source = "guess"),
      "expenses[0]: fx",
    ],
    [
      "a member without a name",
      (raw: any) => delete raw.ledgers[0].members[0].name,
      "members[0]: invalid name",
    ],
    [
      "a settlement with a text amount",
      (raw: any) => (raw.ledgers[0].settlements[0].amountMinor = "640"),
      "settlements[0]: invalid amountMinor",
    ],
    ["a missing ledger", (raw: any) => delete raw.ledgers[0].ledger, "ledger:"],
  ])("rejects %s and says where", (_, mutate, where) => {
    const error = unwrapErr(parseBackup(corrupted(mutate)));
    expect(error.code).toBe("INVALID_BACKUP");
    expect(error).toMatchObject({ reason: expect.stringContaining(where) });
  });
});
