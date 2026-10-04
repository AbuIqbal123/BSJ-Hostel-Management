import { useColorScheme } from "react-native";

const light = {
  ink: "#14261F",
  inkSoft: "#44554C",
  inkFaint: "#6B7A72",
  forest: "#1F4D3A",
  forestDeep: "#16382B",
  paper: "#F2F4F0",
  surface: "#FFFFFF",
  line: "#D4DBD4",
  danger: "#6E2430",
  dangerBg: "#F7E8EA",
  onForest: "#FFFFFF",
};

const dark = {
  ink: "#E8EEE9",
  inkSoft: "#A8B5AD",
  inkFaint: "#7A8A80",
  forest: "#3D8F6E",
  forestDeep: "#2F6F56",
  paper: "#121A16",
  surface: "#1A2420",
  line: "#2A3830",
  danger: "#E0707C",
  dangerBg: "#2E221C",
  onForest: "#FFFFFF",
};

export type HallColors = typeof light;

export function useHallColors(): HallColors {
  const scheme = useColorScheme();
  return scheme === "dark" ? dark : light;
}
