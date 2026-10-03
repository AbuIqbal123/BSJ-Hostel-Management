import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSession } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

export default function HomeScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const { user, loadResidentHome } = useSession();
  const [blockName, setBlockName] = useState<string | null>(null);
  const [roomLabel, setRoomLabel] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadResidentHome().then((result) => {
        if (!active || result.error !== null) {
          return;
        }
        setBlockName(result.home.blockName);
        setRoomLabel(result.home.roomLabel);
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 28,
  },
  fields: { gap: 16 },
  name: { textAlign: "left" },
});
