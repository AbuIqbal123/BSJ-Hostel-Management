import { Pressable, StyleSheet } from "react-native";

import { BackMark } from "@/components/back-mark";
import { useHallColors } from "@/theme/colors";

type BackButtonProps = {
  onPress: () => void;
  label?: string;
  accessibilityLabel?: string;
};

/** The screen back row. One chevron pull, shared by every screen that had its own. */
export function BackButton({ onPress, label = "Back", accessibilityLabel }: BackButtonProps) {
  const colors = useHallColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      hitSlop={8}
      style={styles.hit}
    >
      <BackMark color={colors.inkSoft} label={label} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
    // Optical pull so the chevron meets the screen padding. Not a spacing step.
    marginLeft: -6 /* hall-content */,
  },
});
