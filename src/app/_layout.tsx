import { Stack, ThemeProvider } from "expo-router";

import { DatabaseProvider } from "../features/database/DatabaseProvider";
import { useNavigationTheme } from "../shared/ui/theme";

export default function RootLayout() {
  return (
    <ThemeProvider value={useNavigationTheme()}>
      <DatabaseProvider>
        <Stack screenOptions={{ headerBackTitle: "返回" }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="ledger/new" options={{ title: "建立帳本" }} />
          <Stack.Screen name="ledger/[id]/index" options={{ title: "帳本" }} />
          <Stack.Screen
            name="ledger/[id]/add-expense"
            options={{ title: "新增消費", presentation: "modal" }}
          />
        </Stack>
      </DatabaseProvider>
    </ThemeProvider>
  );
}
