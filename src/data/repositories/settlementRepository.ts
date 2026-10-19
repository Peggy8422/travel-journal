import type {
  SettlementRecord,
  SettlementRepository,
} from "../../domain/ledger";
import type { SqlExecutor } from "../db/sqlDatabase";
import { toEpochMs } from "./shared";

interface SettlementRow {
  id: string;
  ledger_id: string;
  from_id: string;
  to_id: string;
  amount_minor: number;
  settled_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function createSettlementRepository(
  db: SqlExecutor,
): SettlementRepository {
  return {
    async insert(s) {
      await db.runAsync(
        `INSERT INTO settlements (id, ledger_id, from_id, to_id, amount_minor,
           settled_at, settled_at_ms, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          s.id,
          s.ledgerId,
          s.fromId,
          s.toId,
          s.amountMinor,
          s.settledAt,
          toEpochMs(s.settledAt),
          s.createdAt,
          s.updatedAt,
          s.deletedAt,
        ],
      );
    },

    async softDelete(id, deletedAt) {
      await db.runAsync(
        "UPDATE settlements SET deleted_at = ?, updated_at = ? WHERE id = ?",
        [deletedAt, deletedAt, id],
      );
    },

    async findById(id) {
      const row = await db.getFirstAsync<SettlementRow>(
        "SELECT * FROM settlements WHERE id = ?",
        [id],
      );
      return row && toRecord(row);
    },

    async listByLedger(ledgerId, options = {}) {
      const rows = await db.getAllAsync<SettlementRow>(
        `SELECT * FROM settlements
         WHERE ledger_id = ? ${options.includeDeleted ? "" : "AND deleted_at IS NULL"}
         ORDER BY settled_at_ms, created_at, id`,
        [ledgerId],
      );
      return rows.map(toRecord);
    },
  };
}

function toRecord(row: SettlementRow): SettlementRecord {
  return {
    id: row.id,
    ledgerId: row.ledger_id,
    fromId: row.from_id,
    toId: row.to_id,
    amountMinor: row.amount_minor,
    settledAt: row.settled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}
