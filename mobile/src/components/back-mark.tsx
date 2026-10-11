import { Feather } from "@expo/vector-icons";
import { Text } from "react-native";

import { text } from "@/theme/text";

export function BackMark({ color }: { color: string }) {
  return (
    <>
      <Feather name="chevron-left" size={22} color={color} />
      <Text style={[text.button, { color }]}>Back</Text>
    </>
  );
}
