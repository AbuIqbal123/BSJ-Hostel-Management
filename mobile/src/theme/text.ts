import { StyleSheet } from "react-native";

/**
 * Type scale from docs/design/design-system.md §2.
 * Sizes: 12, 13, 14, 15, 17, 22, 28, 34, 40.
 * `name` is display.xl (34). The old 32 hero size is not on the scale.
 */
export const text = StyleSheet.create({
  hallName: {
    fontFamily: "SourceSerif4_600SemiBold",
    fontSize: 28,
    letterSpacing: -0.4,
    textAlign: "center",
  },
  displayM: {
    fontFamily: "SourceSerif4_600SemiBold",
    fontSize: 22,
    letterSpacing: -0.4,
  },
  name: {
    fontFamily: "SourceSerif4_600SemiBold",
    fontSize: 34,
    letterSpacing: -0.4,
  },
  numL: {
    fontFamily: "SourceSerif4_600SemiBold",
    fontSize: 40,
    letterSpacing: -0.6,
  },
  body: {
    fontFamily: "SourceSans3_400Regular",
    fontSize: 17,
  },
  label: {
    fontFamily: "SourceSans3_600SemiBold",
    fontSize: 15,
  },
  caption: {
    fontFamily: "SourceSans3_400Regular",
    fontSize: 13,
  },
  chip: {
    fontFamily: "SourceSans3_600SemiBold",
    fontSize: 12,
  },
  field: {
    fontFamily: "SourceSans3_400Regular",
    fontSize: 17,
  },
  button: {
    fontFamily: "SourceSans3_600SemiBold",
    fontSize: 17,
  },
  mono: {
    fontFamily: "IBMPlexMono_500Medium",
    fontSize: 15,
  },
  monoM: {
    fontFamily: "IBMPlexMono_500Medium",
    fontSize: 14,
  },
  error: {
    fontFamily: "SourceSans3_400Regular",
    fontSize: 15,
  },
});
