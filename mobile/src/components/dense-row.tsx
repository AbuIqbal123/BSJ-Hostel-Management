import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

type DenseRowProps = {
  title: string;
  detail?: string;
  time: string;
  late?: boolean;
  first: boolean;
  last: boolean;
  onPress?: () => void;
};

/** One row of a grouped card: title and detail on the left, a time that never wraps on the right. */
export const DenseRow = memo(function DenseRow({
  title,
  detail,
  time,
  late = false,
  first,
  last,
  onPress,
}: DenseRowProps) {
  const colors = useHallColors();
  const body = (
    <View style={[styles.inner, !first && { borderTopColor: colors.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
      <View style={styles.lines}>
        <Text numberOfLines={1} ellipsizeMode="tail" style={[text.body, styles.title, { color: colors.ink }]}>
          {title}
        </Text>
        {detail ? (
          <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.detail, { color: colors.inkFaint }]}>
            {detail}
          </Text>
        ) : null}
      </View>
      <Text numberOfLines={1} style={[styles.time, { color: late ? colors.danger : colors.inkSoft }]}>
        {time}
      </Text>
    </View>
  );
  const shell = [
    styles.shell,
    { backgroundColor: colors.surface, borderColor: colors.line },
    first && styles.first,
    last && styles.last,
  ];
  if (!onPress) {
    return <View style={shell}>{body}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail ?? ""}. ${time}`}
      onPress={onPress}
      style={({ pressed }) => [...shell, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  shell: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingHorizontal: 14,
  },
  first: {
    borderTopWidth: 1,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  last: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  inner: {
    minHeight: 48,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  lines: { flex: 1, minWidth: 0, gap: 1 },
  title: { fontSize: 16, lineHeight: 21 },
  detail: { fontFamily: "SourceSans3_400Regular", fontSize: 13, lineHeight: 17 },
  time: { fontFamily: "IBMPlexMono_500Medium", fontSize: 13, textAlign: "right", flexShrink: 0 },
  pressed: { opacity: 0.6 },
});
