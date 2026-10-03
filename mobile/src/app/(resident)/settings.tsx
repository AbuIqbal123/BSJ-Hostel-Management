import { View } from "react-native";

import { useHallColors } from "@/theme/colors";

export default function SettingsScreen() {
  const colors = useHallColors();
  return <View style={{ flex: 1, backgroundColor: colors.paper }} />;
}
