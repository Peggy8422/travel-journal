import type {
  ExpenseRecord,
  LedgerRecord,
  MemberRecord,
  SettlementRecord,
} from "./records";
import type { MemberId } from "./types";

/*
 * 帳本資料的讀寫介面（只有型別，不含任何 I/O）。
 * 放在 domain 層，讓 features 層使用、data 層實作。
 *
 * 約定：
 * - id 與時間戳記由呼叫端產生後傳入，repository 不自行產生，方便測試與日後同步。
 * - 資料庫錯誤、違反資料庫約束（例如付款人不屬於該帳本）會 throw。
 *   內容是否合理（例如分攤金額加總）由呼叫端在寫入前用 domain 函式檢查。
 */

export interface LedgerRepository {
  insert(ledger: LedgerRecord): Promise<void>;
  /** 只更新 name 與 updatedAt */
  update(ledger: LedgerRecord): Promise<void>;
  findById(id: string): Promise<LedgerRecord | undefined>;
  /** 依建立時間由新到舊 */
  list(): Promise<LedgerRecord[]>;
  /** 永久刪除帳本，連同成員、消費、結算 */
  delete(id: string): Promise<void>;
}

export type NewMember = Omit<MemberRecord, "sortOrder" | "archivedAt">;

export interface MemberRepository {
  /** 加到帳本最後面，回傳含 sortOrder 的完整紀錄 */
  insert(member: NewMember): Promise<MemberRecord>;
  rename(id: MemberId, name: string): Promise<void>;
  /** archivedAt 傳 null 代表取消封存 */
  setArchived(id: MemberId, archivedAt: string | null): Promise<void>;
  findById(id: MemberId): Promise<MemberRecord | undefined>;
  /** 依加入順序排列，包含已封存的成員 */
  listByLedger(ledgerId: string): Promise<MemberRecord[]>;
  /**
   * 永久刪除成員。只能刪除沒有被引用的成員（先用 isReferenced 確認）；
   * 付款人、結算雙方由外鍵擋下，但 split JSON 裡的引用不受外鍵保護。
   */
  delete(id: MemberId): Promise<void>;
  /** 是否出現在任何消費（付款人或分攤對象）或結算中，包含已刪除的消費與結算 */
  isReferenced(id: MemberId): Promise<boolean>;
}

export interface ExpenseRepository {
  insert(expense: ExpenseRecord): Promise<void>;
  /** 以 id 覆寫整筆消費（createdAt 不變） */
  update(expense: ExpenseRecord): Promise<void>;
  softDelete(id: string, deletedAt: string): Promise<void>;
  findById(id: string): Promise<ExpenseRecord | undefined>;
  /** 依消費時間由舊到新，預設排除已刪除的消費 */
  listByLedger(
    ledgerId: string,
    options?: { readonly includeDeleted?: boolean },
  ): Promise<ExpenseRecord[]>;
}

export interface SettlementRepository {
  insert(settlement: SettlementRecord): Promise<void>;
  softDelete(id: string, deletedAt: string): Promise<void>;
  findById(id: string): Promise<SettlementRecord | undefined>;
  /** 依還款時間由舊到新，預設排除已刪除的結算 */
  listByLedger(
    ledgerId: string,
    options?: { readonly includeDeleted?: boolean },
  ): Promise<SettlementRecord[]>;
}
