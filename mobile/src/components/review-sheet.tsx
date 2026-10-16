import { useState, type ReactNode } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HallButton } from "@/components/hall-button";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

export type Fact = { label: string; value: string };

type ReviewSheetProps = {
  title: string;
  subtitle: string;
  facts: Fact[];
  error: string | null;
  busy: boolean;
  onDecide: (decision: "approved" | "rejected", note: string) => void;
  onClose: () => void;
  extra?: ReactNode;
};

/** A pending request opened over the list with Approve and Reject. */
export function ReviewSheet({ title, subtitle, facts, error, busy, onDecide, onClose, extra }: ReviewSheetProps) {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");

  let actions: ReactNode;
  if (rejecting) {
    actions = (
      <>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Why it is rejected"
          placeholderTextColor={colors.inkFaint}
          autoFocus
          maxLength={500}
          style={[text.field, styles.note, { backgroundColor: colors.surface, borderColor: colors.forest, color: colors.ink }]}
        />
        <View style={styles.buttons}>
          <Pressable accessibilityRole="button" onPress={() => setRejecting(false)} style={styles.button}>
            <Text style={[text.button, { color: colors.inkSoft }]}>Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy, busy }}
            disabled={busy}
            onPress={() => onDecide("rejected", note.trim())}
            style={({ pressed }) => [styles.button, { backgroundColor: colors.danger, opacity: busy || pressed ? 0.7 : 1 }]}
          >
            {busy ? (
              <ActivityIndicator color={colors.onForest} />
            ) : (
              <Text style={[text.button, { color: colors.onForest }]}>Reject</Text>
            )}
          </Pressable>
        </View>
      </>
    );
  } else {
    actions = (
      <View style={styles.buttons}>
        <View style={styles.half}>
          <HallButton label="Approve" busy={busy} onPress={() => onDecide("approved", "")} />
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => setRejecting(true)}
          style={({ pressed }) => [
            styles.button,
            { borderColor: colors.danger, borderWidth: 1, backgroundColor: colors.surface },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[text.button, { color: colors.danger }]}>Reject</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" style={styles.scrim} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.paper, paddingBottom: insets.bottom + 20 }]}>
        <View style={[styles.grab, { backgroundColor: colors.line }]} />
        <View style={styles.top}>
          <Text numberOfLines={1} style={[text.hallName, styles.title, { color: colors.ink }]}>
            {title}
          </Text>
          <View style={[styles.pill, { borderColor: colors.pending, backgroundColor: colors.pendingBg }]}>
            <Text style={[styles.pillText, { color: colors.pending }]}>Pending</Text>
          </View>
        </View>
        <Text numberOfLines={1} style={[styles.subtitle, { color: colors.inkSoft }]}>
          {subtitle}
        </Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          {facts.map((fact) => (
            <View key={fact.label} style={styles.fact}>
              <Text style={[styles.factLabel, { color: colors.inkFaint }]}>{fact.label}</Text>
              <Text numberOfLines={3} style={[text.body, { color: colors.ink }]}>
                {fact.value}
              </Text>
            </View>
          ))}
        </View>
        {error ? <Text accessibilityLiveRegion="polite" style={[text.error, { color: colors.danger }]}>{error}</Text> : null}
        {extra}
        {actions}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(20, 38, 31, 0.32)" },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderCurve: "continuous",
    paddingHorizontal: 28,
    paddingTop: 8,
    gap: 14,
  },
  grab: { alignSelf: "center", width: 36, height: 5, borderRadius: 3, marginBottom: 6 },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  subtitle: { fontFamily: "SourceSans3_400Regular", fontSize: 15, lineHeight: 20, marginTop: -8 },
  title: { flex: 1, textAlign: "left" },
  pill: { borderWidth: 1, borderRadius: 8, borderCurve: "continuous", paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontFamily: "SourceSans3_600SemiBold", fontSize: 13, lineHeight: 18 },
  card: { borderWidth: 1, borderRadius: 12, borderCurve: "continuous", paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  fact: { gap: 2 },
  factLabel: { fontFamily: "SourceSans3_600SemiBold", fontSize: 13, lineHeight: 18 },
  note: { height: 52, borderWidth: 1, borderRadius: 12, borderCurve: "continuous", paddingHorizontal: 14 },
  buttons: { flexDirection: "row", gap: 12 },
  half: { flex: 1 },
  button: {
    flex: 1,
    minHeight: 50,
    borderRadius: 12,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.6 },
});
