import { useEffect, useMemo } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

/** Same settle as the gate Leave tick. */
const TICK_MS = 180;

type HallButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Inline progress. The button stays in place and ignores presses. */
  busy?: boolean;
  /** Brief success mark in place of the label. Presses stay ignored. */
  succeeded?: boolean;
};

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
}: HallButtonProps) {
  const colors = useHallColors();
  const held = disabled || busy || succeeded;
  const labelStyle = useMemo(() => [text.button, { color: colors.onForest }], [colors]);
  const ripple = useMemo(
    () => (Platform.OS === "android" ? { color: colors.forestDeep } : undefined),
    [colors],
  );

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
        {
          backgroundColor: pressed ? colors.forestDeep : colors.forest,
          opacity: disabled || busy ? 0.6 : 1,
          transform: [{ scale: pressed && !held ? 0.98 : 1 }],
        },
      ]}
    >
      {succeeded ? (
        <SuccessMark color={colors.onForest} />
      ) : busy ? (
        <View style={styles.busy}>
          <ActivityIndicator color={colors.onForest} />
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
    borderRadius: 12,
    borderCurve: "continuous",
    overflow: "hidden",
    paddingVertical: 14,
  },
  busy: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
});
