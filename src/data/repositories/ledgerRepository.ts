import type { LedgerRecord, LedgerRepository } from "../../domain/ledger";
import type { SqlExecutor } from "../db/sqlDatabase";

interface LedgerRow {
  id: string;
  name: string;
  base_currency: string;
  created_at: string;
  updated_at: string;
}

export function createLedgerRepository(db: SqlExecutor): LedgerRepository {
  return {
    async insert(ledger) {
      await db.runAsync(
        `INSERT INTO ledgers (id, name, base_currency, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          ledger.id,
          ledger.name,
          ledger.baseCurrency,
          ledger.createdAt,
          ledger.updatedAt,
        ],
      );
    },

    async update(ledger) {
      await db.runAsync(
        "UPDATE ledgers SET name = ?, updated_at = ? WHERE id = ?",
        [ledger.name, ledger.updatedAt, ledger.id],
      );
    },

    async findById(id) {
      const row = await db.getFirstAsync<LedgerRow>(
        "SELECT * FROM ledgers WHERE id = ?",
        [id],
      );
      return row && toRecord(row);
    },

    async list() {
      const rows = await db.getAllAsync<LedgerRow>(
        "SELECT * FROM ledgers ORDER BY created_at DESC, id",
      );
      return rows.map(toRecord);
    },

    async delete(id) {
      await db.runAsync("DELETE FROM ledgers WHERE id = ?", [id]);
    },
  };
}

function toRecord(row: LedgerRow): LedgerRecord {
  return {
    id: row.id,
    name: row.name,
    baseCurrency: row.base_currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
