import { type ReactNode } from "react";
import { Redirect, useNavigation } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { goBackOr } from "@/back";
import { BackMark } from "@/components/back-mark";
import { officeMessage, runsOffice } from "@/office";
import { useSession, type StaffReply } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

export function OfficeFrame({
  title,
  children,
  refreshing = false,
  onRefresh,
  onNearEnd,
}: {
  title: string;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  onNearEnd?: () => void;
}) {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useSession();

  if (!user) {
    return <Redirect href="/sign-in" />;
  }
  if (!runsOffice(user.role)) {
    return <Redirect href="/staff" />;
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 },
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={200}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.inkFaint} />
        ) : undefined
      }
      onScroll={
        onNearEnd
          ? (event) => {
              const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
              if (contentSize.height - (contentOffset.y + layoutMeasurement.height) < 280) {
                onNearEnd();
              }
            }
          : undefined
      }
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => goBackOr(navigation, "/staff")}
        style={styles.back}
      >
        <BackMark color={colors.inkSoft} />
      </Pressable>
      <Text style={[text.hallName, styles.title, { color: colors.ink }]}>{title}</Text>
      {children}
    </ScrollView>
  );
}

export function OfficeError({ message }: { message: string | null }) {
  const colors = useHallColors();
  if (!message) {
    return null;
  }
  return (
    <Text selectable accessibilityLiveRegion="polite" style={[text.error, { color: colors.danger }]}>
      {message}
    </Text>
  );
}

export function replyError(reply: StaffReply): string | null {
  return reply.ok ? null : officeMessage(reply.message, reply.details);
}

export function ChoiceLine({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const colors = useHallColors();
  return (
    <View style={styles.choice}>
      <Text style={[text.label, { color: colors.inkSoft }]}>{label}</Text>
      <View style={styles.options}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              style={[
                styles.option,
                {
                  backgroundColor: selected ? colors.forest : colors.surface,
                  borderColor: selected ? colors.forest : colors.line,
                },
              ]}
            >
              <Text style={[text.button, { color: selected ? colors.onForest : colors.ink }]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 28, gap: 20 },
  back: { alignSelf: "flex-start" },
  title: { textAlign: "left" },
  choice: { gap: 8 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: {
    minHeight: 44,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    paddingHorizontal: 14,
  },
});
