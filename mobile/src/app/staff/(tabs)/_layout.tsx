import { Tabs } from "expo-router/js-tabs";

import { HallTabBar, QrMark, TabIcon } from "@/components/hall-tab-bar";
import { useSession } from "@/session";
import { readsRegister } from "@/staff";

export default function StaffTabs() {
  const { user } = useSession();
  const register = user ? readsRegister(user.role) : false;

  return (
    <Tabs
      initialRouteName="index"
      safeAreaInsets={{ bottom: 0 }}
      screenOptions={{ headerShown: false, animation: "none" }}
      tabBar={(props) => <HallTabBar {...props} />}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarIcon: ({ color }) => <TabIcon name="home" color={color} /> }}
      />
      <Tabs.Screen
        name="scan"
        options={{ title: "Scan", tabBarIcon: ({ color }) => <QrMark color={color} /> }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: "Requests",
          href: register ? undefined : null,
          tabBarIcon: ({ color }) => <TabIcon name="inbox" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Settings", tabBarIcon: ({ color }) => <TabIcon name="settings" color={color} /> }}
      />
    </Tabs>
  );
}
