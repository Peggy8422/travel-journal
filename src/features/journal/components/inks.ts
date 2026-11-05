import type {
  IllustrationInk,
  IllustrationTool,
} from "../../../domain/journal";

/** 插圖的墨水色；代碼存在資料庫，顏色和名稱只在畫面層 */
export const INK_COLORS: Readonly<
  Record<IllustrationInk, { readonly name: string; readonly color: string }>
> = {
  sumi: { name: "墨", color: "#3A332D" },
  shu: { name: "朱", color: "#B5452F" },
  sakura: { name: "櫻", color: "#E0939A" },
  yamabuki: { name: "山吹", color: "#E0A93A" },
  moegi: { name: "萌黃", color: "#7C9E53" },
  ai: { name: "藍", color: "#3F5F8F" },
};

/** 水彩是半透明的粗筆刷，疊上去的地方顏色會變深 */
export const WASH_OPACITY = 0.32;

/** 鉛筆的粗細示意點比筆淡一點 */
export const PENCIL_OPACITY = 0.7;

/** 畫板的紙色；畫板上的橡皮擦直接用這個顏色蓋掉，不用 Mask */
export const PAD_PAPER = "#FFFDF8";

/** 細、中、粗三種筆寬（畫布單位，畫布是 1000 寬），每種工具各自一組 */
export const BRUSH_SIZES: readonly {
  readonly name: string;
  readonly width: Readonly<Record<IllustrationTool, number>>;
}[] = [
  { name: "細", width: { pen: 7, pencil: 6, wash: 40, eraser: 24 } },
  { name: "中", width: { pen: 14, pencil: 10, wash: 75, eraser: 50 } },
  { name: "粗", width: { pen: 26, pencil: 16, wash: 120, eraser: 100 } },
];
