import { StyleSheet, Text, View } from "react-native";

import { HallButton } from "@/components/hall-button";
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
      <HallButton kind="text" label="Retry" onPress={onRetry} />
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
      <HallButton kind="text" label="Retry" onPress={onRetry} />
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
        <HallButton kind="text" label={actionLabel} onPress={onAction} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 12, paddingTop: 28 },
  row: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
});
