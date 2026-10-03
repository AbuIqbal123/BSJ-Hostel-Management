import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HallButton } from "@/components/hall-button";
import { useSession } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

export default function HomeScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const { user, loadResidentHome } = useSession();
  const [blockName, setBlockName] = useState<string | null>(null);
  const [roomLabel, setRoomLabel] = useState<string | null>(null);
  const [out, setOut] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadResidentHome().then((result) => {
        if (!active) {
          return;
        }
        if (result.error !== null) {
          setError(result.error);
          setOut(null);
          return;
        }
        setError(null);
        setBlockName(result.home.blockName);
        setRoomLabel(result.home.roomLabel);
        setOut(result.home.out);
      });
      return () => {
        active = false;
      };
    }, [loadResidentHome]),
  );

  if (!user) {
    return null;
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.block}>
        <View style={styles.fields}>
          <Text selectable style={[text.hallName, styles.name, { color: colors.ink }]}>
            {user.full_name}
          </Text>
          {blockName ? (
            <Text selectable style={[text.body, { color: colors.ink }]}>
              {blockName}
            </Text>
          ) : null}
          {roomLabel ? (
            <Text selectable style={[text.body, { color: colors.ink }]}>
              {roomLabel}
            </Text>
          ) : null}
        </View>
        {out === false ? (
          <HallButton label="Plan an outing" onPress={() => router.navigate("/plan")} />
        ) : null}
        {out === true ? (
          <Text style={[text.body, { color: colors.ink }]}>You are out.</Text>
        ) : null}
        {error ? (
          <Text
            selectable
            style={[
              text.error,
              styles.error,
              { color: colors.danger, backgroundColor: colors.dangerBg },
            ]}
          >
            {error}
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 28,
  },
  block: { gap: 28 },
  fields: { gap: 16 },
  name: { textAlign: "left" },
  error: {
    borderRadius: 12,
    borderCurve: "continuous",
    padding: 12,
  },
});
