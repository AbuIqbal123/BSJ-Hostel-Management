import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { requestsPlaceOnOwnLine } from "@/row-layout";
import { useHallColors } from "@/theme/colors";

type PlainRowProps = {
  title: string;
  /** Subline pieces, 8px apart, no dot separators. The last piece truncates. */
  parts?: string[];
  /**
   * Leading pieces that stay one line and do not shrink. The last piece still
   * truncates on one line. `0` lets the first piece wrap and keeps any later
   * piece on the row. Omit it for the usual one-line subline.
   */
  keepParts?: number;
  /**
   * Lines the first piece may use when `keepParts` is 0. Two is the midnight
   * date. `0` leaves the piece unlimited so both ends stay visible.
   */
  wrapLines?: number;
  /** A third line under the subline. Muted is the quiet recorder line. */
  extra?: string | null;
  mutedExtra?: boolean;
  /** One label on the title line, left of the time column. */
  aside?: string | null;
  /** Date over time. The column keeps one width so every row shares its left edge. */
  time?: readonly [string, string] | null;
  onPress?: () => void;
  label: string;
};

/** A tappable list row. The hairline between rows is drawn by the list, not by this row. */
export function PlainRow({
  title,
  parts,
  keepParts,
  wrapLines,
  extra,
  mutedExtra = false,
  aside,
  time,
  onPress,
  label,
}: PlainRowProps) {
  const colors = useHallColors();
  const { fontScale } = useWindowDimensions();
  const stacked = requestsPlaceOnOwnLine(parts?.length ?? 0, fontScale);
  const two = Boolean((parts && parts.length > 0) || (time && time[1]));
  const three = Boolean(extra);
  const body = (
    <>
      <View style={styles.copy}>
        <View style={styles.titleLine}>
          <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.title, { color: colors.ink }]}>
            {title}
          </Text>
          {aside ? (
            <Text numberOfLines={1} style={[styles.aside, { color: colors.inkSoft }]}>
              {aside}
            </Text>
          ) : null}
        </View>
        {parts && parts.length > 0 && stacked ? (
          <View style={styles.partsStack}>
            <View style={[styles.parts, styles.partsWrap]}>
              {parts.slice(0, -1).map((part, index) => (
                <Text
                  key={`${index}-${part}`}
                  style={[styles.part, styles.partHeld, styles.partWhole, { color: colors.inkSoft }]}
                >
                  {part}
                </Text>
              ))}
            </View>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[styles.part, styles.placeLine, { color: colors.inkSoft }]}
            >
              {parts[parts.length - 1]}
            </Text>
          </View>
        ) : null}
        {parts && parts.length > 0 && !stacked ? (
          <View style={styles.parts}>
            {parts.map((part, index) => {
              const wraps = keepParts === 0 && index === 0;
              const held =
                (keepParts !== undefined && keepParts > 0 && index < keepParts) || (keepParts === 0 && index > 0);
              const clip = index === parts.length - 1 && !held && !wraps;
              const lines = wraps ? (wrapLines === 0 ? undefined : wrapLines ?? 2) : 1;
              const textStyle = [
                styles.part,
                { color: colors.inkSoft },
                wraps ? styles.partWrap : held ? styles.partHeld : clip ? styles.partClip : styles.partFixed,
              ];
              // The place lives in a box that can shrink. A bare text keeps its
              // full width on iOS, which clips the reason and hides the place.
              if (clip) {
                return (
                  <View key={`${index}-${part}`} style={styles.partLast}>
                    <Text numberOfLines={1} ellipsizeMode="tail" style={textStyle}>
                      {part}
                    </Text>
                  </View>
                );
              }
              return (
                <Text key={`${index}-${part}`} numberOfLines={lines} ellipsizeMode="tail" style={textStyle}>
                  {part}
                </Text>
              );
            })}
          </View>
        ) : null}
        {extra ? (
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[mutedExtra ? styles.extraMuted : styles.extra, { color: mutedExtra ? colors.inkFaint : colors.ink }]}
          >
            {extra}
          </Text>
        ) : null}
      </View>
      {time ? (
        <View style={styles.time}>
          <Text
            numberOfLines={1}
            allowFontScaling={false}
            ellipsizeMode="tail"
            style={[styles.timeText, { color: colors.inkFaint }]}
          >
            {time[0]}
          </Text>
          {time[1] ? (
            <Text
              numberOfLines={1}
              allowFontScaling={false}
              ellipsizeMode="tail"
              style={[styles.timeText, { color: colors.inkFaint }]}
            >
              {time[1]}
            </Text>
          ) : null}
        </View>
      ) : null}
      {onPress ? <Feather name="chevron-right" size={18} color={colors.inkFaint} /> : null}
    </>
  );
  const shell = [styles.row, three ? styles.three : two ? styles.two : styles.one];
  if (!onPress) {
    return <View style={shell}>{body}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [...shell, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

export function RowHairline() {
  const colors = useHallColors();
  return <View style={[styles.hairline, { backgroundColor: colors.line }]} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  one: { minHeight: 48, paddingVertical: 13 },
  two: { minHeight: 68, paddingVertical: 12 },
  three: { minHeight: 90, paddingVertical: 12 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  titleLine: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  title: { flex: 1, minWidth: 0, fontFamily: "SourceSans3_600SemiBold", fontSize: 17, lineHeight: 22 },
  aside: { flexShrink: 0, fontFamily: "SourceSans3_400Regular", fontSize: 15, lineHeight: 20 },
  parts: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0, overflow: "hidden" },
  partsStack: { alignSelf: "stretch", minWidth: 0 },
  partsWrap: { flexWrap: "wrap", overflow: "visible" },
  part: { fontFamily: "SourceSans3_400Regular", fontSize: 15, lineHeight: 20 },
  partFixed: { flexShrink: 1 },
  partHeld: { flexShrink: 0 },
  partWhole: { maxWidth: "100%" },
  partWrap: { flexShrink: 1, minWidth: 0 },
  partClip: { width: "100%" },
  partLast: { flex: 1, minWidth: 0 },
  placeLine: { alignSelf: "stretch" },
  extra: { fontFamily: "SourceSans3_600SemiBold", fontSize: 17, lineHeight: 22 },
  extraMuted: { fontFamily: "SourceSans3_400Regular", fontSize: 15, lineHeight: 20 },
  time: { width: 88, maxWidth: 88, flexGrow: 0, flexShrink: 0, overflow: "hidden" },
  timeText: {
    width: 88,
    maxWidth: 88,
    fontFamily: "IBMPlexMono_500Medium",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "right",
  },
  hairline: { height: StyleSheet.hairlineWidth },
  pressed: { opacity: 0.6 },
});
