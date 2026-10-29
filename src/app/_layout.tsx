import { useFonts } from "expo-font";
import { Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { DatabaseProvider } from "../features/database/DatabaseProvider";
import { BotQuoteCacheRefresher } from "../features/ledger/components/BotQuoteCacheRefresher";
import { fontAssets, fonts } from "../shared/ui/fonts";
import { useNavigationTheme, useTheme } from "../shared/ui/theme";
import { ToastProvider } from "../shared/ui/Toast";

// 字型載入完才收起啟動畫面，避免先閃一下系統字型
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const theme = useTheme();
  const navigationTheme = useNavigationTheme();
  const [loaded, error] = useFonts(fontAssets);

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  // 載入失敗時照常顯示，文字會退回系統字型
  if (!loaded && !error) return null;

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style="dark" />
      <DatabaseProvider>
        <BotQuoteCacheRefresher />
        <ToastProvider>
          <Stack
            screenOptions={{
              headerBackTitle: "返回",
              headerShadowVisible: false,
              headerStyle: { backgroundColor: theme.background },
              headerTitleStyle: { fontFamily: fonts.bold, fontSize: 18 },
              headerBackTitleStyle: { fontFamily: fonts.regular },
              contentStyle: { backgroundColor: theme.background },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="ledger/new" options={{ title: "建立帳本" }} />
            <Stack.Screen name="backup" options={{ title: "備份與還原" }} />
            <Stack.Screen
              name="personal/spending"
              options={{ title: "個人記帳", headerShown: false }}
            />
            <Stack.Screen
              name="personal/add-expense"
              options={{ title: "新增個人消費", presentation: "modal" }}
            />
            <Stack.Screen
              name="personal/expense/[expenseId]"
              options={{ title: "編輯個人消費", presentation: "modal" }}
            />
            {/* 帳本內頁、設定、統計自己畫頁首（返回鍵、封面色帶），不用導覽列 */}
            <Stack.Screen
              name="ledger/[id]/index"
              options={{ title: "帳本", headerShown: false }}
            />
            <Stack.Screen
              name="ledger/[id]/settings"
              options={{ title: "帳本設定", headerShown: false }}
            />
            <Stack.Screen
              name="ledger/[id]/stats"
              options={{ title: "統計", headerShown: false }}
            />
            <Stack.Screen
              name="ledger/[id]/add-expense"
              options={{ title: "新增消費", presentation: "modal" }}
            />
            <Stack.Screen
              name="ledger/[id]/expense/[expenseId]"
              options={{ title: "編輯消費", presentation: "modal" }}
            />
          </Stack>
        </ToastProvider>
      </DatabaseProvider>
    </ThemeProvider>
  );
}
