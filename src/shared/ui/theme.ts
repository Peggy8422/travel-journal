import { DarkTheme, DefaultTheme } from "expo-router";
import { useColorScheme } from "react-native";

const light = {
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
};

const dark: typeof light = {
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
};

export type Theme = typeof light;

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
