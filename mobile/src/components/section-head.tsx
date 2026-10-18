import { StyleSheet, Text, View } from "react-native";

import { useHallColors } from "@/theme/colors";

/** Section title and its count: semibold inkFaint 13 on paper, so it can stick over a list. */
export function SectionHead({ title, count, padTop = 20 }: { title: string; count?: string; padTop?: number }) {
  const colors = useHallColors();
  return (
    <View style={[styles.head, { backgroundColor: colors.paper, paddingTop: padTop }]}>
      <Text numberOfLines={1} style={[styles.label, styles.title, { color: colors.inkFaint }]}>
        {title}
      </Text>
      {count ? (
        <Text numberOfLines={1} style={[styles.label, { color: colors.inkFaint }]}>
          {count}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "baseline", gap: 12, paddingBottom: 8 },
  title: { flex: 1 },
  label: { fontFamily: "SourceSans3_600SemiBold", fontSize: 13, lineHeight: 18, letterSpacing: 0.3 },
});
