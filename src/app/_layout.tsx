import { Stack, ThemeProvider } from "expo-router";

import { DatabaseProvider } from "../features/database/DatabaseProvider";
import { BotQuoteCacheRefresher } from "../features/ledger/components/BotQuoteCacheRefresher";
import { useNavigationTheme } from "../shared/ui/theme";

export default function RootLayout() {
  return (
    <ThemeProvider value={useNavigationTheme()}>
      <DatabaseProvider>
        <BotQuoteCacheRefresher />
        <Stack screenOptions={{ headerBackTitle: "返回" }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="ledger/new" options={{ title: "建立帳本" }} />
          <Stack.Screen name="backup" options={{ title: "備份與還原" }} />
          <Stack.Screen name="ledger/[id]/index" options={{ title: "帳本" }} />
          <Stack.Screen
            name="ledger/[id]/settings"
            options={{ title: "帳本設定" }}
          />
          <Stack.Screen name="ledger/[id]/stats" options={{ title: "統計" }} />
          <Stack.Screen
            name="ledger/[id]/add-expense"
            options={{ title: "新增消費", presentation: "modal" }}
          />
          <Stack.Screen
            name="ledger/[id]/expense/[expenseId]"
            options={{ title: "編輯消費", presentation: "modal" }}
          />
        </Stack>
      </DatabaseProvider>
    </ThemeProvider>
  );
}
