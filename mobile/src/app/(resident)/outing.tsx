import { useLocalSearchParams, useNavigation } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { goBackOr } from "@/back";
import { BackMark } from "@/components/back-mark";
import { formatClockDay } from "@/format-when";
import { paramText } from "@/route-param";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

export default function OutingRecordScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{
    place?: string | string[];
    startedAt?: string | string[];
    endedAt?: string | string[];
    exitRecordedBy?: string | string[];
    returnRecordedBy?: string | string[];
    unused?: string | string[];
  }>();
  const place = paramText(params.place);
  const startedAt = paramText(params.startedAt);
  const endedAt = paramText(params.endedAt);
  const exitRecordedBy = paramText(params.exitRecordedBy);
  const returnRecordedBy = paramText(params.returnRecordedBy);
  const unused = paramText(params.unused) === "1";
  const facts = [
    { label: "Leave at", value: startedAt ? formatClockDay(startedAt) : "" },
    { label: "Back by", value: endedAt ? formatClockDay(endedAt) : "" },
    { label: "Exit recorded by", value: exitRecordedBy },
    { label: "Return recorded by", value: returnRecordedBy },
  ].filter((fact) => fact.value.length > 0);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => goBackOr(navigation, "/history")}
        style={styles.back}
      >
        <BackMark color={colors.inkSoft} />
      </Pressable>
      <Text style={[text.hallName, styles.title, { color: colors.ink }]}>
        {place.length > 0 ? place : "Outing"}
      </Text>
      <Text style={[text.body, { color: colors.inkSoft }]}>{unused ? "Unused outing" : "Outing"}</Text>
      {facts.map((fact) => (
        <View key={fact.label} style={[styles.fact, { borderBottomColor: colors.line }]}>
          <Text style={[text.label, { color: colors.inkSoft }]}>{fact.label}</Text>
          <Text selectable style={[text.body, { color: colors.ink }]}>
            {fact.value}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 28,
    gap: 16,
  },
  back: { alignSelf: "flex-start", minHeight: 44, flexDirection: "row", alignItems: "center", gap: 2, marginLeft: -6 },
  title: { textAlign: "left" },
  fact: { paddingVertical: 12, gap: 4, borderBottomWidth: StyleSheet.hairlineWidth },
});
