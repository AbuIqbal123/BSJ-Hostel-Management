import { Tabs } from "expo-router/js-tabs";

import { HallTabBar, QrMark, TabIcon } from "@/components/hall-tab-bar";

export default function ResidentTabs() {
  return (
    <Tabs
      initialRouteName="home"
      safeAreaInsets={{ bottom: 0 }}
      screenOptions={{
        headerShown: false,
        animation: "none",
      }}
      tabBar={(props) => <HallTabBar {...props} />}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="pass"
        options={{
          title: "Pass",
          tabBarIcon: ({ color }) => <QrMark color={color} />,
        }}
      />
      <Tabs.Screen
        name="permissions"
        options={{
          title: "Permissions",
          tabBarIcon: ({ color }) => <TabIcon name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <TabIcon name="settings" color={color} />,
        }}
      />
    </Tabs>
  );
}
