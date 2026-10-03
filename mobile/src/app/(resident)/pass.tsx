import { View } from "react-native";

import { useHallColors } from "@/theme/colors";

export default function HallPassScreen() {
  const colors = useHallColors();
  return <View style={{ flex: 1, backgroundColor: colors.paper }} />;
}
