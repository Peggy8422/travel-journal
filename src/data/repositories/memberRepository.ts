import type { MemberRecord, MemberRepository } from "../../domain/ledger";
import type { SqlExecutor } from "../db/sqlDatabase";

interface MemberRow {
  id: string;
  ledger_id: string;
  name: string;
  sort_order: number;
  archived_at: string | null;
  is_self: number;
  created_at: string;
}

export function createMemberRepository(db: SqlExecutor): MemberRepository {
  return {
    async insert(member) {
      // sort_order 在同一個 INSERT 裡算出，接在帳本現有成員之後
      await db.runAsync(
        `INSERT INTO members (id, ledger_id, name, sort_order, archived_at, created_at)
         SELECT ?, ?, ?, coalesce(max(sort_order) + 1, 0), NULL, ?
         FROM members WHERE ledger_id = ?`,
        [
          member.id,
          member.ledgerId,
          member.name,
          member.createdAt,
          member.ledgerId,
        ],
      );
      const row = await db.getFirstAsync<MemberRow>(
        "SELECT * FROM members WHERE id = ?",
        [member.id],
      );
      if (!row) throw new Error(`Member ${member.id} was not inserted`);
      return toRecord(row);
    },

    async rename(id, name) {
      await db.runAsync("UPDATE members SET name = ? WHERE id = ?", [name, id]);
    },

    async setArchived(id, archivedAt) {
      await db.runAsync("UPDATE members SET archived_at = ? WHERE id = ?", [
        archivedAt,
        id,
      ]);
    },

    async setSelf(ledgerId, memberId) {
      // 先清掉再設定，部分唯一索引保證同帳本最多一位「我」
      await db.runAsync(
        "UPDATE members SET is_self = 0 WHERE ledger_id = ? AND is_self = 1",
        [ledgerId],
      );
      if (memberId === null) return;
      const { changes } = await db.runAsync(
        "UPDATE members SET is_self = 1 WHERE id = ? AND ledger_id = ?",
        [memberId, ledgerId],
      );
      if (changes === 0) {
        throw new Error(`Member ${memberId} is not in ledger ${ledgerId}`);
      }
    },

    async findById(id) {
      const row = await db.getFirstAsync<MemberRow>(
        "SELECT * FROM members WHERE id = ?",
        [id],
      );
      return row && toRecord(row);
    },

    async delete(id) {
      await db.runAsync("DELETE FROM members WHERE id = ?", [id]);
    },

    async listByLedger(ledgerId) {
      const rows = await db.getAllAsync<MemberRow>(
        "SELECT * FROM members WHERE ledger_id = ? ORDER BY sort_order",
        [ledgerId],
      );
      return rows.map(toRecord);
    },

    async isReferenced(id) {
      // 分攤對象存在 split JSON 裡：equal 在 participantIds，exact 在 shares[].memberId
      const row = await db.getFirstAsync<{ referenced: number }>(
        `SELECT
           EXISTS (SELECT 1 FROM expenses WHERE payer_id = ?)
           OR EXISTS (
             SELECT 1 FROM expenses e, json_each(e.split, '$.participantIds') p
             WHERE p.value = ?
           )
           OR EXISTS (
             SELECT 1 FROM expenses e, json_each(e.split, '$.shares') s
             WHERE json_extract(s.value, '$.memberId') = ?
           )
           OR EXISTS (SELECT 1 FROM settlements WHERE from_id = ? OR to_id = ?)
           AS referenced`,
        [id, id, id, id, id],
      );
      return row?.referenced === 1;
    },
  };
}

function toRecord(row: MemberRow): MemberRecord {
  return {
    id: row.id,
    ledgerId: row.ledger_id,
    name: row.name,
    sortOrder: row.sort_order,
    archivedAt: row.archived_at,
    isSelf: row.is_self === 1,
    createdAt: row.created_at,
  };
}
