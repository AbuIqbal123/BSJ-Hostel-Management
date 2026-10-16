import { Pressable, StyleSheet, Text, View } from "react-native";

import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

/** First-page failure. The list is not blank, and the message is not only a toast. */
export function ListError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const colors = useHallColors();
  return (
    <View style={styles.block}>
      <Text accessibilityLiveRegion="polite" style={[text.body, { color: colors.danger }]}>
        {message}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Retry" onPress={onRetry} hitSlop={12}>
        <Text style={[text.button, { color: colors.forest }]}>Retry</Text>
      </Pressable>
    </View>
  );
}

/** A later page failed. Rows already on screen stay. */
export function RetryRow({ message, onRetry }: { message: string; onRetry: () => void }) {
  const colors = useHallColors();
  return (
    <View style={styles.row}>
      <Text accessibilityLiveRegion="polite" style={[text.body, { color: colors.inkSoft }]}>
        {message}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Retry" onPress={onRetry} hitSlop={12}>
        <Text style={[text.button, { color: colors.forest }]}>Retry</Text>
      </Pressable>
    </View>
  );
}

export function EmptyState({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const colors = useHallColors();
  return (
    <View style={styles.block}>
      <Text style={[text.body, { color: colors.inkSoft }]}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onAction} hitSlop={12}>
          <Text style={[text.button, { color: colors.forest }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 12, paddingTop: 28 },
  row: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
});
