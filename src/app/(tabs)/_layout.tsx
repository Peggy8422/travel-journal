import { Tabs } from "expo-router";

import { fonts } from "../../shared/ui/fonts";
import { TabBarBackground, TabLabel, tabBarIcon } from "../../shared/ui/tabBar";
import { useTheme } from "../../shared/ui/theme";

export default function TabLayout() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: theme.background },
        headerTitleStyle: { fontFamily: fonts.bold, fontSize: 18 },
        sceneStyle: { backgroundColor: theme.background },
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarBackground: () => <TabBarBackground />,
        tabBarLabel: ({ focused, color, children }) => (
          <TabLabel focused={focused} color={color}>
            {children}
          </TabLabel>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "地圖", tabBarIcon: tabBarIcon("globe") }}
      />
      <Tabs.Screen
        name="ledgers"
        // 書架自己畫標題與篩選（固定在上方），不用導覽列的標題
        options={{
          title: "帳本",
          headerShown: false,
          tabBarIcon: tabBarIcon("notebook"),
        }}
      />
      <Tabs.Screen
        name="personal"
        // 個人分頁自己畫頁首（「我」的印章），不用導覽列的標題
        options={{
          title: "個人",
          headerShown: false,
          tabBarIcon: tabBarIcon("person"),
        }}
      />
    </Tabs>
  );
}
