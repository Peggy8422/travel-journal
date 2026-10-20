import { DarkTheme, DefaultTheme } from "expo-router";
import { useColorScheme } from "react-native";

export interface Theme {
  readonly isDark: boolean;
  readonly background: string;
  readonly surface: string;
  readonly text: string;
  readonly textMuted: string;
  readonly border: string;
  readonly primary: string;
  readonly onPrimary: string;
  readonly positive: string;
  readonly negative: string;
  readonly chip: string;
  /**
   * 圖表的分類色，依固定順序使用（顏色跟著項目走，不依排名）。
   * 已用 dataviz 驗證腳本對各自的卡片背景驗證相鄰色可分辨（含色盲）；
   * 淺色模式有 3 色對背景不到 3:1，圖表必須附上文字標籤。
   */
  readonly categorical: readonly string[];
  /** 圖表中「未分類」等沒有身分的項目 */
  readonly neutral: string;
}

const light: Theme = {
  isDark: false,
  background: "#F7F7F5",
  surface: "#FFFFFF",
  text: "#1C1C1E",
  textMuted: "#6B6B70",
  border: "#E2E2E0",
  primary: "#208AEF",
  onPrimary: "#FFFFFF",
  positive: "#1A7F37",
  negative: "#CF222E",
  chip: "#ECECEA",
  categorical: [
    "#2a78d6",
    "#eb6834",
    "#1baf7a",
    "#eda100",
    "#e87ba4",
    "#008300",
  ],
  neutral: "#a3a29c",
};

const dark: Theme = {
  isDark: true,
  background: "#121212",
  surface: "#1E1E1F",
  text: "#F2F2F2",
  textMuted: "#A0A0A5",
  border: "#333335",
  primary: "#4BA3F5",
  onPrimary: "#FFFFFF",
  positive: "#4CC26B",
  negative: "#F2666F",
  chip: "#2A2A2C",
  // 與淺色模式同一組色相，依深色背景調整明度
  categorical: [
    "#3987e5",
    "#d95926",
    "#199e70",
    "#c98500",
    "#d55181",
    "#008300",
  ],
  neutral: "#6b6a66",
};

/** 跟隨系統的淺色／深色模式 */
export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}

/**
 * 導覽列、分頁列與畫面背景用的主題，顏色與 useTheme 一致。
 * 沒有設定時 React Navigation 一律用淺色，深色模式下會和畫面內容不一致。
 */
export function useNavigationTheme() {
  const theme = useTheme();
  const base = theme.isDark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: theme.primary,
      background: theme.background,
      card: theme.surface,
      text: theme.text,
      border: theme.border,
    },
  };
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
