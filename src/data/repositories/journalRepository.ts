import {
  parseJournalCover,
  type JournalRecord,
  type JournalRepository,
} from "../../domain/journal";
import type { SqlExecutor } from "../db/sqlDatabase";

interface JournalRow {
  id: string;
  name: string;
  ledger_id: string | null;
  cover_tape: string;
  cover_photo: string | null;
  created_at: string;
  updated_at: string;
}

export function createJournalRepository(db: SqlExecutor): JournalRepository {
  return {
    async insert(journal) {
      await db.runAsync(
        `INSERT INTO journals (id, name, ledger_id, cover_tape, cover_photo,
           created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          journal.id,
          journal.name,
          journal.ledgerId,
          journal.cover.tape,
          journal.cover.photo,
          journal.createdAt,
          journal.updatedAt,
        ],
      );
    },

    async update(journal) {
      await db.runAsync(
        `UPDATE journals SET name = ?, ledger_id = ?, cover_tape = ?,
           cover_photo = ?, updated_at = ?
         WHERE id = ?`,
        [
          journal.name,
          journal.ledgerId,
          journal.cover.tape,
          journal.cover.photo,
          journal.updatedAt,
          journal.id,
        ],
      );
    },

    async findById(id) {
      const row = await db.getFirstAsync<JournalRow>(
        "SELECT * FROM journals WHERE id = ?",
        [id],
      );
      return row && toRecord(row);
    },

    async findByLedger(ledgerId) {
      const row = await db.getFirstAsync<JournalRow>(
        "SELECT * FROM journals WHERE ledger_id = ?",
        [ledgerId],
      );
      return row && toRecord(row);
    },

    async list() {
      const rows = await db.getAllAsync<JournalRow>(
        "SELECT * FROM journals ORDER BY created_at DESC, id",
      );
      return rows.map(toRecord);
    },

    async delete(id) {
      await db.runAsync("DELETE FROM journals WHERE id = ?", [id]);
    },
  };
}

function toRecord(row: JournalRow): JournalRecord {
  return {
    id: row.id,
    name: row.name,
    ledgerId: row.ledger_id,
    cover: parseJournalCover(row.cover_tape, row.cover_photo),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
