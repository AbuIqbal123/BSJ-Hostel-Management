import { useCallback, useState } from "react";
import { useFocusEffect, useNavigation } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { goBackOr } from "@/back";
import { type ResidentHome, useSession } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

function Line({ label, value }: { label: string; value: string }) {
  const colors = useHallColors();
  return (
    <View style={styles.line}>
      <Text style={[text.body, { color: colors.inkSoft }]}>{label}</Text>
      <Text selectable style={[text.button, styles.value, { color: colors.ink }]}>
        {value}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { loadResidentHome } = useSession();
  const [home, setHome] = useState<ResidentHome | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadResidentHome().then((result) => {
        if (!active) {
          return;
        }
        if (result.error !== null) {
          setHome(null);
          setFailed(true);
          return;
        }
        setFailed(false);
        setHome(result.home);
      });
      return () => {
        active = false;
      };
    }, [attempt, loadResidentHome]),
  );

  const back = () => goBackOr(navigation, "/settings");
  const place = [home?.roomLabel, home?.blockName].filter((part) => part && part.length > 0).join(", ");

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 },
      ]}
    >
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} style={styles.back}>
        <Text style={[text.button, { color: colors.inkSoft }]}>Back</Text>
      </Pressable>
      <Text style={[text.hallName, styles.title, { color: colors.ink }]}>Profile</Text>
      {failed ? (
        <Text style={[text.body, { color: colors.inkSoft }]}>Your profile could not be loaded.</Text>
      ) : home ? (
        <View style={styles.lines}>
          <Text selectable style={[text.name, { color: colors.ink }]}>
            {home.fullName}
          </Text>
          {home.hallName ? <Line label="Hall" value={home.hallName} /> : null}
          {place.length > 0 ? <Line label="Room" value={place} /> : null}
          {home.enrolment ? <Line label="Enrolment" value={home.enrolment} /> : null}
          {home.course ? <Line label="Course" value={home.course} /> : null}
          <Line label="Where you are" value={home.out ? "Outside" : "Inside"} />
          <Line label="Ordinary outings returned" value={String(home.returnedOutings)} />
        </View>
      ) : (
        <Text style={[text.body, { color: colors.inkSoft }]}>Loading your profile.</Text>
      )}
      {failed ? (
        <Pressable accessibilityRole="button" onPress={() => setAttempt((value) => value + 1)}>
          <Text style={[text.button, { color: colors.ink }]}>Try again</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 28,
    gap: 28,
  },
  back: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  title: { textAlign: "left" },
  lines: { gap: 16 },
  line: { gap: 2 },
  value: { fontVariant: ["tabular-nums"] },
});
