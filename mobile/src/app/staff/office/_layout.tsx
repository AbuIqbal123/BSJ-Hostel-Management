import { Redirect } from "expo-router";
import { Stack } from "expo-router/stack";

import { runsOffice } from "@/office";
import { useSession } from "@/session";
import { useHallColors } from "@/theme/colors";

export default function OfficeLayout() {
  const colors = useHallColors();
  const { user } = useSession();

  if (!user) {
    return <Redirect href="/sign-in" />;
  }
  if (!runsOffice(user.role)) {
    return <Redirect href="/staff" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }} />
  );
}
