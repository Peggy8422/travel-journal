import type { JournalTape } from "../../../domain/journal";
import { coverFromId, type LedgerRecord } from "../../../domain/ledger";
import { COVER_COLORS } from "../../ledger/components/coverStyles";

/** 手帳封面的紙膠帶顏色；代碼存在資料庫，顏色和名稱只在畫面層 */
export const TAPE_COLORS: Readonly<
  Record<JournalTape, { readonly name: string; readonly color: string }>
> = {
  sakura: { name: "櫻", color: "#E6B1AC" },
  yamabuki: { name: "山吹", color: "#E9C46A" },
  matcha: { name: "抹茶", color: "#9DB07A" },
  ai: { name: "藍", color: "#6683AA" },
  fuji: { name: "藤", color: "#A596C5" },
};

/** 牛皮紙筆記本的固定配色 */
export const KRAFT = {
  paper: "#D8C29E",
  spine: "#BFA57C",
  band: "#7E5F3A",
  dot: "rgba(120,90,50,0.13)",
  ink: "#5E4A30",
} as const;

/** 綁定的帳本在手帳畫面上的小圓點顏色：帳本封面的底色 */
export function ledgerDotColor(ledger: LedgerRecord): string {
  return COVER_COLORS[(ledger.cover ?? coverFromId(ledger.id)).palette].base;
}
