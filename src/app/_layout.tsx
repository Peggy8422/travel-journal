import { Stack } from "expo-router";

import { DatabaseProvider } from "../features/database/DatabaseProvider";

export default function RootLayout() {
  return (
    <DatabaseProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="ledger/[id]" options={{ title: "Ledger" }} />
      </Stack>
    </DatabaseProvider>
  );
}
