import { type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

type FilterChipRowProps = {
  children: ReactNode;
  /** Extra style on the wrap row (gap is already 8). */
  contentStyle?: StyleProp<ViewStyle>;
  accessibilityRole?: "tablist";
};

/**
 * Filter chips in a wrapping row. A horizontal ScrollView inside a vertical
 * ScrollView was stretching chips to fill leftover height on Gate history;
 * a plain wrap row keeps each chip content-sized.
 */
export function FilterChipRow({ children, contentStyle, accessibilityRole }: FilterChipRowProps) {
  return (
    <View accessibilityRole={accessibilityRole} style={[styles.row, contentStyle]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    alignContent: "flex-start",
    gap: 8,
    flexGrow: 0,
    flexShrink: 0,
  },
});
