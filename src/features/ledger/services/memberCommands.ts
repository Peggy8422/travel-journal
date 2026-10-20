import { err, ok } from "../../../domain/common/result";
import type { MemberId, MemberRecord } from "../../../domain/ledger";
import {
  createRepositories,
  type Repositories,
} from "../../../data/repositories";
import type { CommandResult, LedgerCommandDeps } from "./ledgerCommands";

/*
 * 成員管理。新增成員在 ledgerCommands.addMember。
 * 已經出現在消費或還款裡的成員不能刪除，只能封存：
 * 封存的成員不能被加進新消費，但舊資料仍會照常計算。
 */

export async function renameMember(
  deps: LedgerCommandDeps,
  memberId: MemberId,
  name: string,
): CommandResult<MemberRecord> {
  const trimmed = name.trim();
  if (trimmed === "") return err({ code: "EMPTY_NAME" });
  const repos = createRepositories(deps.db);
  const member = await repos.members.findById(memberId);
  if (!member) return err({ code: "MEMBER_NOT_FOUND", memberId });

  await repos.members.rename(memberId, trimmed);
  return ok({ ...member, name: trimmed });
}

/** 封存成員。已封存時不做任何事；不能封存帳本裡最後一位未封存的成員 */
export async function archiveMember(
  deps: LedgerCommandDeps,
  memberId: MemberId,
): CommandResult<MemberRecord> {
  const repos = createRepositories(deps.db);
  const member = await repos.members.findById(memberId);
  if (!member) return err({ code: "MEMBER_NOT_FOUND", memberId });
  if (member.archivedAt !== null) return ok(member);

  if (await isLastActiveMember(repos, member)) {
    return err({ code: "LAST_ACTIVE_MEMBER", memberId });
  }
  const archivedAt = deps.now().toISOString();
  await repos.members.setArchived(memberId, archivedAt);
  return ok({ ...member, archivedAt });
}

export async function unarchiveMember(
  deps: LedgerCommandDeps,
  memberId: MemberId,
): CommandResult<MemberRecord> {
  const repos = createRepositories(deps.db);
  const member = await repos.members.findById(memberId);
  if (!member) return err({ code: "MEMBER_NOT_FOUND", memberId });

  await repos.members.setArchived(memberId, null);
  return ok({ ...member, archivedAt: null });
}

/**
 * 刪除成員，只允許還沒出現在任何消費或還款（包含已刪除的）裡的成員，
 * 例如建立帳本時多加、打錯名字的人。被引用時回傳 MEMBER_REFERENCED，畫面可改提示封存。
 */
export async function removeMember(
  deps: LedgerCommandDeps,
  memberId: MemberId,
): CommandResult<void> {
  // 檢查與刪除放在同一個 transaction，避免檢查後才被加進消費
  return deps.db.transaction(async (tx) => {
    const repos = createRepositories(tx);
    const member = await repos.members.findById(memberId);
    if (!member) return err({ code: "MEMBER_NOT_FOUND", memberId });
    if (await repos.members.isReferenced(memberId)) {
      return err({ code: "MEMBER_REFERENCED", memberId });
    }
    if (await isLastActiveMember(repos, member)) {
      return err({ code: "LAST_ACTIVE_MEMBER", memberId });
    }
    await repos.members.delete(memberId);
    return ok(undefined);
  });
}

async function isLastActiveMember(
  repos: Repositories,
  member: MemberRecord,
): Promise<boolean> {
  if (member.archivedAt !== null) return false;
  const members = await repos.members.listByLedger(member.ledgerId);
  return members.every((m) => m.id === member.id || m.archivedAt !== null);
}
