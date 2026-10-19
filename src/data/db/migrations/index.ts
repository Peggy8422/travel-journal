import { migration001 } from "./001_initial";

export interface Migration {
  readonly version: number;
  readonly sql: string;
}

/** 依版本號遞增排列，版本號必須從 1 開始連續 */
export const MIGRATIONS: readonly Migration[] = [migration001];
