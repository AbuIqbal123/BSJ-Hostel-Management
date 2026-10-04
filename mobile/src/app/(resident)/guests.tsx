import { useCallback, useState } from "react";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatHallDate } from "@/format-when";
import { useSession, type GuestStayCard } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

export function guestLine(item: GuestStayCard): string {
  if (item.bucket === "in_hall") {
    return "In the hall";
  }
  if (item.bucket === "should_have_left") {
    return "Should have left";
  }
  if (item.status === "approved" && item.paymentStatus === "unpaid") {
    return "Approved, not yet paid";
  }
  if (item.status === "pending") {
    return "Pending";
  }
  if (item.status === "approved") {
    return "Approved";
  }
  if (item.status === "rejected") {
    return "Rejected";
  }
  if (item.status === "cancelled") {
    return "Cancelled";
  }
  return "Departed";
}

export default function GuestsScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { loadGuestStays } = useSession();
  const [items, setItems] = useState<GuestStayCard[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    let active = true;
    void loadGuestStays().then((result) => {
      if (!active) {
        return;
      }
      if (result.error !== null) {
        setItems(null);
        setFailed(true);
        return;
      }
      setFailed(false);
      setItems(result.items);
    });
    return () => {
      active = false;
    };
  }, [loadGuestStays]);

  useFocusEffect(load);

  const back = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    router.navigate("/home");
  };

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
      <Text style={[text.hallName, styles.title, { color: colors.ink }]}>Guest stay</Text>
      {failed ? (
        <Text style={[text.error, { color: colors.danger }]}>Guest stays didn't load.</Text>
      ) : null}
      {items !== null && items.length > 0 ? (
        <View>
          {items.map((item, index) => (
            <View key={item.id}>
              {index > 0 ? <View style={[styles.hairline, { backgroundColor: colors.line }]} /> : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push({ pathname: "/guest", params: { id: item.id } })}
                style={({ pressed }) => [styles.item, pressed && styles.pressed]}
              >
                <Text style={[styles.name, { color: colors.ink }]}>{item.guestName}</Text>
                <Text style={[text.body, { color: colors.inkSoft }]}>
                  {`${formatHallDate(item.startDate)} to ${formatHallDate(item.endDate)}`}
                </Text>
                <Text style={[text.body, { color: colors.ink }]}>{guestLine(item)}</Text>
              </Pressable>
            </View>
          ))}
        </View>
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
  item: { paddingVertical: 14, gap: 4 },
  name: {
    fontFamily: "SourceSerif4_600SemiBold",
    fontSize: 17,
    letterSpacing: -0.2,
  },
  hairline: { height: StyleSheet.hairlineWidth },
  pressed: { opacity: 0.6 },
});
