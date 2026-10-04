import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatWhen, formatWhenParts } from "@/format-when";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

function paramText(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw ?? "";
}

function whenLine(iso: string): string {
  const parts = formatWhenParts(iso);
  if (!parts) {
    return formatWhen(iso);
  }
  return `${parts.clock}, ${parts.day}`;
}

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
    { label: "Leave at", value: startedAt ? whenLine(startedAt) : "" },
    { label: "Back by", value: endedAt ? whenLine(endedAt) : "" },
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
        onPress={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
            return;
          }
          router.navigate("/history");
        }}
        style={styles.back}
      >
        <Text style={[text.button, { color: colors.inkSoft }]}>Back</Text>
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
  back: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  title: { textAlign: "left" },
  fact: { paddingVertical: 12, gap: 4, borderBottomWidth: StyleSheet.hairlineWidth },
});
