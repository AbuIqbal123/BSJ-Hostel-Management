import { type ReactNode } from "react";
import { ScrollView, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

type FilterChipRowProps = {
  children: ReactNode;
  /** Extra content-container style (gap is already 8). */
  contentStyle?: StyleProp<ViewStyle>;
  accessibilityRole?: "tablist";
};

/**
 * Horizontal filter chips. flexGrow stays 0 so a parent flex column
 * cannot stretch the chips to fill leftover height.
 */
export function FilterChipRow({ children, contentStyle, accessibilityRole }: FilterChipRowProps) {
  return (
    <ScrollView
      horizontal
      accessibilityRole={accessibilityRole}
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={[styles.content, contentStyle]}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 0 },
  content: { gap: 8, alignItems: "center", flexGrow: 0 },
});
