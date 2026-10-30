import { migration001 } from "./001_initial";
import { migration002 } from "./002_personal_ledger";
import { migration003 } from "./003_ledger_cover";
import { migration004 } from "./004_ledger_trip_month";

export interface Migration {
  readonly version: number;
  readonly sql: string;
}

/** 依版本號遞增排列，版本號必須從 1 開始連續 */
export const MIGRATIONS: readonly Migration[] = [
  migration001,
  migration002,
  migration003,
  migration004,
];
