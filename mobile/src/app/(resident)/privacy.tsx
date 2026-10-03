import { router, useNavigation } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

export default function PrivacyScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const back = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    router.navigate("/settings");
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 40 },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={back}
        style={styles.back}
      >
        <Text style={[text.button, { color: colors.inkSoft }]}>Back</Text>
      </Pressable>
      <View style={styles.heading}>
        <Text style={[text.hallName, styles.title, { color: colors.ink }]}>Privacy policy</Text>
        <Text style={[text.body, { color: colors.inkSoft }]}>3 October 2026</Text>
      </View>
      <Text style={[text.body, styles.paragraph, { color: colors.ink }]}>
        Begum Sultan Jahan Hall keeps a record so the hall can look after its residents. This
        policy says what that record is, and who can see it.
      </Text>
      <View style={styles.section}>
        <Text style={[text.button, { color: colors.ink }]}>What you give the hall</Text>
        <Text style={[text.body, styles.paragraph, { color: colors.ink }]}>
          Your name, enrolment number, phone, and course. Your guardian's name and phone. A
          password, so you can sign in. The room you live in. The outings, permissions, and guest
          stays you request. The hall pass code that the gate scans.
        </Text>
        <Text style={[text.body, styles.paragraph, { color: colors.ink }]}>
          The hall may send a late notice or a return notice to the guardian phone on file.
        </Text>
      </View>
      <View style={styles.section}>
        <Text style={[text.button, { color: colors.ink }]}>What stays on this phone</Text>
        <Text style={[text.body, styles.paragraph, { color: colors.ink }]}>
          This phone keeps your sign-in until you sign out. Signing out ends that session. You can
          change your password from Settings.
        </Text>
      </View>
      <View style={styles.section}>
        <Text style={[text.button, { color: colors.ink }]}>Who can see it</Text>
        <Text style={[text.body, styles.paragraph, { color: colors.ink }]}>
          Gate staff, the warden, and the provost see the parts their work needs. Another resident
          cannot read your record. The hall does not sell this information, and the app does not
          show ads.
        </Text>
      </View>
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
  back: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
  },
  heading: { gap: 8 },
  title: { textAlign: "left" },
  section: { gap: 12 },
  paragraph: { lineHeight: 24 },
});
