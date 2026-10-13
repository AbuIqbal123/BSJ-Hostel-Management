import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useHallColors } from "@/theme/colors";

type DenseRowProps = {
  title: string;
  detail?: string;
  time: string;
  late?: boolean;
  first: boolean;
  last: boolean;
  onPress?: () => void;
};

/**
 * One row of a grouped card. Primary: name, semibold ink 17. Secondary: room and place, inkSoft 15.
 * Meta: time or how late, mono inkFaint 13, right-aligned and never wrapped. Late meta uses danger.
 */
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
        <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.title, { color: colors.ink }]}>
          {title}
        </Text>
        {detail ? (
          <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.detail, { color: colors.inkSoft }]}>
            {detail}
          </Text>
        ) : null}
      </View>
      <Text numberOfLines={1} style={[styles.time, { color: late ? colors.danger : colors.inkFaint }]}>
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
    minHeight: 56,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  lines: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: "SourceSans3_600SemiBold", fontSize: 17, lineHeight: 22 },
  detail: { fontFamily: "SourceSans3_400Regular", fontSize: 15, lineHeight: 20 },
  time: { fontFamily: "IBMPlexMono_500Medium", fontSize: 13, lineHeight: 18, textAlign: "right", flexShrink: 0 },
  pressed: { opacity: 0.6 },
});
