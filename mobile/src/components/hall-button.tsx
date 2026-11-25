import { useEffect, useMemo } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { gate, useHallColors, type HallColors } from "@/theme/colors";
import { text } from "@/theme/text";

/** Same settle as the gate Leave tick. */
const TICK_MS = 180;

export type HallButtonKind = "primary" | "secondary" | "text" | "danger";

type HallButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Inline progress. The button stays in place and ignores presses. */
  busy?: boolean;
  /** Brief success mark in place of the label. Presses stay ignored. */
  succeeded?: boolean;
  /** Filled forest is the default. A screen keeps one primary. */
  kind?: HallButtonKind;
  /** Gate scan uses gold on the night shell. */
  tone?: "hall" | "gate";
  style?: StyleProp<ViewStyle>;
};

type Paint = {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  labelColor: string;
  pressedOpacity: number;
};

function paint(kind: HallButtonKind, tone: "hall" | "gate", colors: HallColors): Paint {
  if (tone === "gate" && kind === "primary") {
    return {
      backgroundColor: gate.gold,
      borderColor: gate.gold,
      borderWidth: 0,
      labelColor: gate.bg,
      pressedOpacity: 0.88,
    };
  }
  if (kind === "primary") {
    return {
      backgroundColor: colors.forest,
      borderColor: colors.forest,
      borderWidth: 0,
      labelColor: colors.onForest,
      pressedOpacity: 1,
    };
  }
  if (kind === "secondary") {
    return {
      backgroundColor: colors.surface,
      borderColor: colors.lineStrong,
      borderWidth: 1,
      labelColor: colors.ink,
      pressedOpacity: 1,
    };
  }
  if (kind === "danger") {
    return {
      backgroundColor: colors.surface,
      borderColor: colors.danger,
      borderWidth: 1,
      labelColor: colors.danger,
      pressedOpacity: 1,
    };
  }
  return {
    backgroundColor: "transparent",
    borderColor: "transparent",
    borderWidth: 0,
    labelColor: colors.forest,
    pressedOpacity: 0.6,
  };
}

function SuccessMark({ color }: { color: string }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(reduced ? 1 : 0.7);
  useEffect(() => {
    if (reduced) {
      scale.set(1);
      return;
    }
    scale.set(
      withTiming(1, {
        duration: TICK_MS,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [reduced, scale]);
  const motion = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));
  return (
    <Animated.View accessible={false} importantForAccessibility="no" style={motion}>
      <Ionicons name="checkmark-circle" size={22} color={color} />
    </Animated.View>
  );
}

export function HallButton({
  label,
  onPress,
  disabled = false,
  busy = false,
  succeeded = false,
  kind = "primary",
  tone = "hall",
  style,
}: HallButtonProps) {
  const colors = useHallColors();
  const held = disabled || busy || succeeded;
  const face = useMemo(() => paint(kind, tone, colors), [colors, kind, tone]);
  const labelStyle = useMemo(() => [text.button, { color: face.labelColor }], [face.labelColor]);
  const ripple = useMemo(() => {
    if (Platform.OS !== "android") {
      return undefined;
    }
    if (tone === "gate") {
      return { color: gate.gold };
    }
    return { color: kind === "danger" ? colors.danger : colors.forestDeep };
  }, [colors, kind, tone]);
  const filled = kind !== "text";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityLiveRegion={succeeded ? "polite" : "none"}
      accessibilityState={{ disabled: held, busy }}
      disabled={held}
      onPress={onPress}
      android_ripple={ripple}
      style={({ pressed }) => [
        styles.button,
        filled ? styles.filled : styles.quiet,
        {
          backgroundColor:
            pressed && kind === "primary" && tone === "hall"
              ? colors.forestDeep
              : pressed && kind === "secondary"
                ? colors.paper2
                : pressed && kind === "danger"
                  ? colors.dangerBg
                  : face.backgroundColor,
          borderColor: face.borderColor,
          borderWidth: face.borderWidth,
          opacity: disabled || busy ? 0.6 : pressed ? face.pressedOpacity : 1,
          transform: [{ scale: pressed && !held && filled ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {succeeded ? (
        <SuccessMark color={face.labelColor} />
      ) : busy ? (
        <View style={styles.busy}>
          <ActivityIndicator color={face.labelColor} />
          <Text style={labelStyle}>{label}</Text>
        </View>
      ) : (
        <Text style={labelStyle}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
    borderCurve: "continuous",
    overflow: "hidden",
  },
  filled: {
    alignSelf: "stretch",
    borderRadius: 16,
    paddingVertical: 16,
  },
  quiet: {
    alignSelf: "flex-start",
    paddingVertical: 8,
  },
  busy: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
});
