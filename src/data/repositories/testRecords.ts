// 僅供測試使用的共用資料，不應被正式程式碼 import。
import type {
  ExpenseRecord,
  LedgerRecord,
  SettlementRecord,
} from "../../domain/ledger";
import { createTestDatabase } from "../db/testDatabase";
import { createRepositories } from "./index";

export const T0 = "2026-10-01T00:00:00.000Z";

export function makeLedgerRecord(
  overrides: Partial<LedgerRecord> = {},
): LedgerRecord {
  return {
    id: "ledger-1",
    kind: "shared",
    name: "東京五日遊",
    baseCurrency: "TWD",
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
}

export function makeExpenseRecord(
  overrides: Partial<ExpenseRecord> = {},
): ExpenseRecord {
  return {
    id: "e1",
    ledgerId: "ledger-1",
    payerId: "a",
    amountMinor: 3000,
    currency: "JPY",
    fx: {
      rateToBase: "0.2134",
      source: "bot-live",
      quoteDate: "2026-10-12",
      basis: "spot",
    },
    split: { kind: "equal", participantIds: ["a", "b", "c"] },
    title: "拉麵",
    note: null,
    category: null,
    placeName: null,
    location: null,
    occurredAt: "2026-10-12T12:00:00+09:00",
    createdAt: T0,
    updatedAt: T0,
    deletedAt: null,
    ...overrides,
  };
}

export function makeSettlementRecord(
  overrides: Partial<SettlementRecord> = {},
): SettlementRecord {
  return {
    id: "s1",
    ledgerId: "ledger-1",
    fromId: "b",
    toId: "a",
    amountMinor: 640,
    settledAt: "2026-10-15T20:00:00+08:00",
    createdAt: T0,
    updatedAt: T0,
    deletedAt: null,
    ...overrides,
  };
}

/** 建立已有一本帳本（ledger-1）與成員 a、b、c 的資料庫 */
export async function setupLedger(ledgerId = "ledger-1") {
  const db = await createTestDatabase();
  const repos = createRepositories(db, () => new Date(T0));
  await repos.ledgers.insert(makeLedgerRecord({ id: ledgerId }));
  for (const [id, name] of [
    ["a", "Alice"],
    ["b", "Bob"],
    ["c", "Carol"],
  ]) {
    await repos.members.insert({ id, ledgerId, name, createdAt: T0 });
  }
  return { db, repos };
}
