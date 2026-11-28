import { useState, type ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HallButton } from "@/components/hall-button";
import { TextField } from "@/components/text-field";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

export type Fact = { label: string; value: string };

type ReviewSheetProps = {
  title: string;
  subtitle: string;
  facts: Fact[];
  error: string | null;
  busy: boolean;
  /** Brief check on Approve after the hall accepts the decision. */
  succeeded?: boolean;
  /** Provost only. When omitted, the sheet is read-only (warden may still mark payment via `extra`). */
  onDecide?: (decision: "approved" | "rejected", note: string) => void;
  onClose: () => void;
  extra?: ReactNode;
};

/** A pending request opened over the list; Approve and Reject when `onDecide` is set. */
export function ReviewSheet({
  title,
  subtitle,
  facts,
  error,
  busy,
  succeeded = false,
  onDecide,
  onClose,
  extra,
}: ReviewSheetProps) {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");

  let actions: ReactNode = null;
  if (onDecide && rejecting) {
    actions = (
      <>
        <TextField
          label="Why it is rejected"
          value={note}
          onChangeText={setNote}
          autoFocus
          maxLength={500}
          autoCapitalize="sentences"
        />
        <View style={styles.buttons}>
          <HallButton kind="text" label="Cancel" onPress={() => setRejecting(false)} style={styles.grow} />
          <HallButton
            kind="danger"
            label="Reject"
            busy={busy}
            disabled={busy}
            onPress={() => onDecide?.("rejected", note.trim())}
            style={styles.grow}
          />
        </View>
      </>
    );
  } else if (onDecide) {
    actions = (
      <View style={styles.buttons}>
        <HallButton
          label="Approve"
          busy={busy}
          succeeded={succeeded}
          onPress={() => onDecide("approved", "")}
          style={styles.grow}
        />
        <HallButton kind="danger" label="Reject" onPress={() => setRejecting(true)} style={styles.grow} />
      </View>
    );
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" style={[styles.scrim, { backgroundColor: colors.scrim }]} onPress={onClose} />
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
          {facts.map((fact, index) => (
            <View key={`${fact.label}-${index}`} style={styles.fact}>
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
  scrim: { flex: 1 },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderCurve: "continuous",
    paddingHorizontal: 28,
    paddingTop: 8,
    gap: 13,
  },
  grab: { alignSelf: "center", width: 36, height: 5, borderRadius: 999, marginBottom: 8 },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  subtitle: { fontFamily: "SourceSans3_400Regular", fontSize: 15, lineHeight: 20, marginTop: -8 },
  title: { flex: 1, textAlign: "left" },
  pill: { borderWidth: 1, borderRadius: 12, borderCurve: "continuous", paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontFamily: "SourceSans3_600SemiBold", fontSize: 13, lineHeight: 18 },
  card: { borderWidth: 1, borderRadius: 12, borderCurve: "continuous", paddingHorizontal: 13, paddingVertical: 12, gap: 12 },
  fact: { gap: 2 },
  factLabel: { fontFamily: "SourceSans3_600SemiBold", fontSize: 13, lineHeight: 18 },
  buttons: { flexDirection: "row", gap: 12, alignItems: "center" },
  grow: { flex: 1, alignSelf: "stretch" },
});
