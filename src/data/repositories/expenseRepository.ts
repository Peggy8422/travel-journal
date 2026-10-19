import type {
  ExpenseFx,
  ExpenseRecord,
  ExpenseRepository,
} from "../../domain/ledger";
import type { SqlExecutor, SqlValue } from "../db/sqlDatabase";
import { decodeSplitRule, encodeSplitRule } from "../db/splitRuleJson";
import { StoredDataError, toEpochMs } from "./shared";

interface ExpenseRow {
  id: string;
  ledger_id: string;
  payer_id: string;
  amount_minor: number;
  currency: string;
  fx_rate_to_base: string | null;
  fx_source: "bot-live" | "bot-cached" | "manual" | null;
  fx_quote_date: string | null;
  fx_basis: "spot" | "cash" | null;
  split: string;
  title: string;
  note: string | null;
  category: string | null;
  place_name: string | null;
  latitude: number | null;
  longitude: number | null;
  occurred_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** INSERT 與 UPDATE 共用的欄位順序，對應 toParams 的回傳值 */
const COLUMNS = [
  "ledger_id",
  "payer_id",
  "amount_minor",
  "currency",
  "fx_rate_to_base",
  "fx_source",
  "fx_quote_date",
  "fx_basis",
  "split",
  "title",
  "note",
  "category",
  "place_name",
  "latitude",
  "longitude",
  "occurred_at",
  "occurred_at_ms",
  "updated_at",
  "deleted_at",
] as const;

export function createExpenseRepository(db: SqlExecutor): ExpenseRepository {
  return {
    async insert(expense) {
      await db.runAsync(
        `INSERT INTO expenses (id, created_at, ${COLUMNS.join(", ")})
         VALUES (?, ?, ${COLUMNS.map(() => "?").join(", ")})`,
        [expense.id, expense.createdAt, ...toParams(expense)],
      );
    },

    async update(expense) {
      await db.runAsync(
        `UPDATE expenses SET ${COLUMNS.map((c) => `${c} = ?`).join(", ")}
         WHERE id = ?`,
        [...toParams(expense), expense.id],
      );
    },

    async softDelete(id, deletedAt) {
      await db.runAsync(
        "UPDATE expenses SET deleted_at = ?, updated_at = ? WHERE id = ?",
        [deletedAt, deletedAt, id],
      );
    },

    async findById(id) {
      const row = await db.getFirstAsync<ExpenseRow>(
        "SELECT * FROM expenses WHERE id = ?",
        [id],
      );
      return row && toRecord(row);
    },

    async listByLedger(ledgerId, options = {}) {
      const rows = await db.getAllAsync<ExpenseRow>(
        `SELECT * FROM expenses
         WHERE ledger_id = ? ${options.includeDeleted ? "" : "AND deleted_at IS NULL"}
         ORDER BY occurred_at_ms, created_at, id`,
        [ledgerId],
      );
      return rows.map(toRecord);
    },
  };
}

function toParams(expense: ExpenseRecord): SqlValue[] {
  const fx = expense.fx;
  const botFx = fx && fx.source !== "manual" ? fx : null;
  return [
    expense.ledgerId,
    expense.payerId,
    expense.amountMinor,
    expense.currency,
    fx?.rateToBase ?? null,
    fx?.source ?? null,
    botFx?.quoteDate ?? null,
    botFx?.basis ?? null,
    encodeSplitRule(expense.split),
    expense.title,
    expense.note,
    expense.category,
    expense.placeName,
    expense.location?.latitude ?? null,
    expense.location?.longitude ?? null,
    expense.occurredAt,
    toEpochMs(expense.occurredAt),
    expense.updatedAt,
    expense.deletedAt,
  ];
}

function toRecord(row: ExpenseRow): ExpenseRecord {
  const split = decodeSplitRule(row.split);
  if (!split.ok) {
    throw new StoredDataError("expenses", row.id, split.error.reason);
  }
  return {
    id: row.id,
    ledgerId: row.ledger_id,
    payerId: row.payer_id,
    amountMinor: row.amount_minor,
    currency: row.currency,
    fx: toFx(row),
    split: split.value,
    title: row.title,
    note: row.note,
    category: row.category,
    placeName: row.place_name,
    location:
      row.latitude === null || row.longitude === null
        ? null
        : { latitude: row.latitude, longitude: row.longitude },
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

/** 欄位組合的一致性由資料表的 CHECK 保證 */
function toFx(row: ExpenseRow): ExpenseFx | null {
  if (row.fx_rate_to_base === null || row.fx_source === null) return null;
  if (row.fx_source === "manual") {
    return { rateToBase: row.fx_rate_to_base, source: "manual" };
  }
  if (row.fx_quote_date === null || row.fx_basis === null) {
    throw new StoredDataError("expenses", row.id, "missing BOT quote info");
  }
  return {
    rateToBase: row.fx_rate_to_base,
    source: row.fx_source,
    quoteDate: row.fx_quote_date,
    basis: row.fx_basis,
  };
}
