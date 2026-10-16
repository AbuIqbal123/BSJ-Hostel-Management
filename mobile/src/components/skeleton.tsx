import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet, View } from "react-native";

import { placeholderMotion } from "@/list-page";
import { useHallColors } from "@/theme/colors";

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (live) {
        setReduce(value);
      }
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);
  return reduce;
}

/** Grey bars in the shape of the rows that are about to appear. */
export function SkeletonRows({ count, kind }: { count: number; kind: "card" | "row" }) {
  const colors = useHallColors();
  const reduce = useReduceMotion();
  const opacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    if (placeholderMotion(reduce) === "still") {
      opacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduce]);

  const bone = { backgroundColor: colors.line };
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading">
      {Array.from({ length: count }, (_, index) =>
        kind === "card" ? (
          <Animated.View
            key={index}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line, opacity }, index > 0 && styles.gap]}
          >
            <View style={[styles.line, styles.title, bone]} />
            <View style={[styles.line, styles.detail, bone]} />
          </Animated.View>
        ) : (
          <Animated.View
            key={index}
            style={[
              styles.row,
              {
                backgroundColor: colors.surface,
                borderColor: colors.line,
                opacity,
                borderTopWidth: index === 0 ? 1 : StyleSheet.hairlineWidth,
                borderTopLeftRadius: index === 0 ? 12 : 0,
                borderTopRightRadius: index === 0 ? 12 : 0,
                borderBottomLeftRadius: index === count - 1 ? 12 : 0,
                borderBottomRightRadius: index === count - 1 ? 12 : 0,
                borderBottomWidth: index === count - 1 ? 1 : 0,
              },
            ]}
          >
            <View style={styles.rowText}>
              <View style={[styles.line, styles.title, bone]} />
              <View style={[styles.line, styles.detail, bone]} />
            </View>
            <View style={[styles.line, styles.meta, bone]} />
          </Animated.View>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    justifyContent: "center",
  },
  gap: { marginTop: 12 },
  row: {
    minHeight: 56,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowText: { flex: 1, gap: 6 },
  line: { borderRadius: 6, height: 12 },
  title: { width: "62%" },
  detail: { width: "40%", height: 10 },
  meta: { width: 48, height: 10 },
});
