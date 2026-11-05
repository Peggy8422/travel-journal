import { err, ok } from "../../../domain/common/result";
import {
  hasInk,
  ILLUSTRATION_STROKE_LIMIT,
  parseStrokes,
  type IllustrationRecord,
  type IllustrationStroke,
} from "../../../domain/journal";
import type { SqlExecutor } from "../../../data/db/sqlDatabase";
import { createRepositories } from "../../../data/repositories";
import type {
  JournalCommandDeps,
  JournalCommandResult,
} from "./journalCommands";

/*
 * 「我的插圖」：使用者自己畫的插圖，畫一次可以貼在很多篇日記上。
 */

export interface IllustrationOverview {
  readonly illustration: IllustrationRecord;
  /** 貼在幾篇日記上（不算已刪除的日記） */
  readonly useCount: number;
}

/** 所有插圖，最新畫的在前 */
export async function loadIllustrationLibrary(
  db: SqlExecutor,
): Promise<IllustrationOverview[]> {
  const repos = createRepositories(db);
  const [illustrations, counts] = await Promise.all([
    repos.illustrations.list(),
    repos.illustrations.useCounts(),
  ]);
  return illustrations.map((illustration) => ({
    illustration,
    useCount: counts[illustration.id] ?? 0,
  }));
}

export async function loadIllustration(
  db: SqlExecutor,
  illustrationId: string,
): JournalCommandResult<IllustrationOverview> {
  const repos = createRepositories(db);
  const illustration = await repos.illustrations.findById(illustrationId);
  if (!illustration) {
    return err({ code: "ILLUSTRATION_NOT_FOUND", illustrationId });
  }
  const counts = await repos.illustrations.useCounts();
  return ok({ illustration, useCount: counts[illustrationId] ?? 0 });
}

/**
 * 存一張插圖：illustrationId 為 null 時是新畫的，否則是改畫（貼在日記上的跟著變）。
 * 筆畫照 parseStrokes 整理過再存（座標取整數、夾回畫布內）。
 */
export async function saveIllustration(
  deps: JournalCommandDeps,
  illustrationId: string | null,
  strokes: readonly IllustrationStroke[],
): JournalCommandResult<IllustrationRecord> {
  if (!hasInk(strokes)) return err({ code: "EMPTY_ILLUSTRATION" });
  const parsed = parseStrokes(strokes);
  if (!parsed.ok) {
    return err({
      code: "ILLUSTRATION_TOO_BIG",
      maxStrokes: ILLUSTRATION_STROKE_LIMIT,
    });
  }
  const repos = createRepositories(deps.db);
  const timestamp = deps.now().toISOString();
  if (illustrationId === null) {
    const illustration: IllustrationRecord = {
      id: deps.newId(),
      strokes: parsed.value,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await repos.illustrations.insert(illustration);
    return ok(illustration);
  }
  const existing = await repos.illustrations.findById(illustrationId);
  if (!existing) {
    return err({ code: "ILLUSTRATION_NOT_FOUND", illustrationId });
  }
  const updated: IllustrationRecord = {
    ...existing,
    strokes: parsed.value,
    updatedAt: timestamp,
  };
  await repos.illustrations.update(updated);
  return ok(updated);
}

/** 永久刪除，貼在日記上的也一起拿掉（沒有復原） */
export async function deleteIllustration(
  deps: JournalCommandDeps,
  illustrationId: string,
): JournalCommandResult<void> {
  const repos = createRepositories(deps.db);
  if (!(await repos.illustrations.findById(illustrationId))) {
    return err({ code: "ILLUSTRATION_NOT_FOUND", illustrationId });
  }
  await repos.illustrations.delete(illustrationId);
  return ok(undefined);
}
