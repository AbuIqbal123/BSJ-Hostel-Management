import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { text } from "@/theme/text";

/** Chevron and Back on one line — parents do not need their own row style. */
export function BackMark({ color }: { color: string }) {
  return (
    <View style={styles.row}>
      <Feather name="chevron-left" size={22} color={color} />
      <Text style={[text.button, { color }]}>Back</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 2 },
});
