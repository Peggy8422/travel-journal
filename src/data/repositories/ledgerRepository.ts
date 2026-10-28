import {
  isTripMonth,
  parseCover,
  type LedgerKind,
  type LedgerRecord,
  type LedgerRepository,
} from "../../domain/ledger";
import type { SqlExecutor } from "../db/sqlDatabase";

interface LedgerRow {
  id: string;
  kind: LedgerKind;
  name: string;
  base_currency: string;
  cover_style: string | null;
  cover_palette: string | null;
  cover_pattern: string | null;
  trip_month: string | null;
  created_at: string;
  updated_at: string;
}

export function createLedgerRepository(db: SqlExecutor): LedgerRepository {
  return {
    async insert(ledger) {
      await db.runAsync(
        `INSERT INTO ledgers (id, kind, name, base_currency,
           cover_style, cover_palette, cover_pattern, trip_month,
           created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ledger.id,
          ledger.kind,
          ledger.name,
          ledger.baseCurrency,
          ledger.cover?.style ?? null,
          ledger.cover?.palette ?? null,
          ledger.cover?.pattern ?? null,
          ledger.tripMonth,
          ledger.createdAt,
          ledger.updatedAt,
        ],
      );
    },

    async update(ledger) {
      await db.runAsync(
        `UPDATE ledgers SET name = ?, cover_style = ?, cover_palette = ?,
           cover_pattern = ?, trip_month = ?, updated_at = ?
         WHERE id = ?`,
        [
          ledger.name,
          ledger.cover?.style ?? null,
          ledger.cover?.palette ?? null,
          ledger.cover?.pattern ?? null,
          ledger.tripMonth,
          ledger.updatedAt,
          ledger.id,
        ],
      );
    },

    async findById(id) {
      const row = await db.getFirstAsync<LedgerRow>(
        "SELECT * FROM ledgers WHERE id = ?",
        [id],
      );
      return row && toRecord(row);
    },

    async list(options = {}) {
      const rows = await db.getAllAsync<LedgerRow>(
        `SELECT * FROM ledgers ${options.kind ? "WHERE kind = ?" : ""}
         ORDER BY created_at DESC, id`,
        options.kind ? [options.kind] : [],
      );
      return rows.map(toRecord);
    },

    async findPersonal() {
      const row = await db.getFirstAsync<LedgerRow>(
        "SELECT * FROM ledgers WHERE kind = 'personal'",
      );
      return row && toRecord(row);
    },

    async delete(id) {
      await db.runAsync("DELETE FROM ledgers WHERE id = ?", [id]);
    },
  };
}

function toRecord(row: LedgerRow): LedgerRecord {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    baseCurrency: row.base_currency,
    cover: parseCover(row.cover_style, row.cover_palette, row.cover_pattern),
    tripMonth: isTripMonth(row.trip_month) ? row.trip_month : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
