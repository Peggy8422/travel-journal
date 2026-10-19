import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: "地圖" }} />
      <Tabs.Screen name="ledgers" options={{ title: "帳本" }} />
    </Tabs>
  );
}
