import { Caveat_700Bold } from "@expo-google-fonts/caveat";
import {
  LXGWWenKaiTC_400Regular,
  LXGWWenKaiTC_700Bold,
} from "@expo-google-fonts/lxgw-wenkai-tc";

/**
 * 字型名稱。自訂字型不會從 View 繼承，也不能用 fontWeight 切換字重，
 * 所以粗體要直接指定 fonts.bold，不要再加 fontWeight。
 */
export const fonts = {
  /** 霞鶩文楷 TC：所有中文介面 */
  regular: "LXGWWenKaiTC_400Regular",
  bold: "LXGWWenKaiTC_700Bold",
  /** Caveat：只用在英文點綴、日期與數字標記 */
  accent: "Caveat_700Bold",
} as const;

/**
 * Caveat 的字形會超出字寬（數字最多多出約 0.1em），Text 的框只包住字寬，
 * 右邊那一截會被切掉；用 fonts.accent 的 Text 要在右邊留這麼多 padding。
 */
export function accentOverhang(fontSize: number): number {
  return Math.ceil(fontSize * 0.11);
}

/**
 * 給 expo-font 的 useFonts 載入的字型檔（key 就是 fontFamily 名稱）。
 * 霞鶩文楷每個字重約 13MB，只帶 Regular 與 Bold。
 */
export const fontAssets = {
  [fonts.regular]: LXGWWenKaiTC_400Regular,
  [fonts.bold]: LXGWWenKaiTC_700Bold,
  [fonts.accent]: Caveat_700Bold,
};
