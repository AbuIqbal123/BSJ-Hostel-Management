import { StyleSheet, Text, View } from "react-native";

import { statusSentence, statusTone } from "@/requests";
import type { PermissionStatus } from "@/session";
import { useHallColors } from "@/theme/colors";

/** The permission-detail pill. Colour comes from `statusTone`; the word is the status, or `label`. */
export function StatusPill({ status, label }: { status: PermissionStatus; label?: string }) {
  const colors = useHallColors();
  const tone = statusTone(status, colors);
  return (
    <View style={[styles.status, { borderColor: tone.border, backgroundColor: tone.background }]}>
      <Text numberOfLines={1} style={[styles.statusText, { color: tone.color }]}>
        {label ?? statusSentence(status)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  status: {
    borderWidth: 1,
    borderRadius: 8,
    borderCurve: "continuous",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: {
    fontFamily: "SourceSans3_600SemiBold",
    fontSize: 13,
    lineHeight: 18,
  },
});
