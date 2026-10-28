import { DefaultTheme } from "expo-router";

import { fonts } from "./fonts";

export interface Theme {
  readonly isDark: boolean;
  /** 和紙：畫面底色，搭配方眼點陣 */
  readonly background: string;
  /** 卡片紙：卡片、標籤、輸入區 */
  readonly surface: string;
  /** 墨：主要文字 */
  readonly text: string;
  /** 淡墨：次要文字，在和紙上約 5:1 */
  readonly textMuted: string;
  /** 細分隔線 */
  readonly border: string;
  /** 鉛筆線：手繪邊框 */
  readonly pencil: string;
  /** 朱：主要按鈕與強調，上面放紙色文字約 5:1 */
  readonly primary: string;
  readonly onPrimary: string;
  /** 藍：正數、別人欠他 */
  readonly positive: string;
  /** 深朱：負數、錯誤、刪除 */
  readonly negative: string;
  /** 淺色底：未選取的選項、次要按鈕 */
  readonly chip: string;
  /** 山吹：水彩底（選取中的分頁等），只當底色不放文字 */
  readonly wash: string;
  /**
   * 圖表的分類色，依固定順序使用（顏色跟著項目走，不依排名）。
   * 已用 dataviz 驗證腳本對 surface 驗證相鄰色可分辨（含色盲）；
   * 購物的山吹色對背景不到 3:1，圖表必須附上文字標籤。
   */
  readonly categorical: readonly string[];
  /** 圖表中「未分類」等沒有身分的項目 */
  readonly neutral: string;
}

// 這一版只有和紙淺色；深色「夜間墨色」之後再設計，所以不跟系統切換
const paper: Theme = {
  isDark: false,
  background: "#F3EDE1",
  surface: "#FBF8F1",
  text: "#3A332D",
  textMuted: "#6E645A",
  border: "#DDD3C3",
  pencil: "rgba(58,51,45,0.55)",
  primary: "#A3452E",
  onPrimary: "#FBF8F1",
  positive: "#2F5D99",
  negative: "#A3452E",
  chip: "#EFE7D8",
  wash: "#E9C46A",
  categorical: [
    "#D4623F",
    "#3F72B8",
    "#3E9A6A",
    "#E0A01F",
    "#8A63C4",
    "#D46A92",
  ],
  neutral: "#A39B90",
};

export function useTheme(): Theme {
  return paper;
}

/**
 * 導覽列、分頁列與畫面背景用的主題，顏色與字型都和 useTheme 一致；
 * header 標題、返回鍵、分頁標籤都會用霞鶩文楷。
 */
export function useNavigationTheme() {
  const theme = useTheme();
  const regular = { fontFamily: fonts.regular, fontWeight: "normal" } as const;
  const bold = { fontFamily: fonts.bold, fontWeight: "normal" } as const;
  return {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: theme.primary,
      background: theme.background,
      card: theme.background,
      text: theme.text,
      border: theme.border,
    },
    fonts: { regular, medium: regular, bold, heavy: bold },
  };
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
