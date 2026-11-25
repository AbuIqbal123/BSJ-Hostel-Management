import { useDark } from "@/theme/appearance";

/**
 * Light, dark, and gate palettes from docs/design/design-system.md §§3–4.
 * Hex and rgba live only in this file.
 */
export type HallColors = {
  ink: string;
  inkSoft: string;
  inkFaint: string;
  forest: string;
  forestDeep: string;
  leaf: string;
  gold: string;
  goldSoft: string;
  paper: string;
  paper2: string;
  surface: string;
  surfaceRaised: string;
  line: string;
  lineStrong: string;
  outside: string;
  outsideBg: string;
  late: string;
  lateBg: string;
  pending: string;
  pendingBg: string;
  approvedBg: string;
  danger: string;
  dangerBg: string;
  onForest: string;
  chip: string;
  scrim: string;
  shadow: string;
};

export const light: HallColors = {
  ink: "#14261F",
  inkSoft: "#44554C",
  inkFaint: "#6B7A72",
  forest: "#1F4D3A",
  forestDeep: "#16382B",
  leaf: "#2A6A4E",
  gold: "#A68438",
  goldSoft: "#F0E6C9",
  paper: "#F2F4F0",
  paper2: "#E7EBE4",
  surface: "#FFFFFF",
  surfaceRaised: "#FFFFFF",
  line: "#D4DBD4",
  lineStrong: "#B7C0B7",
  outside: "#35506C",
  outsideBg: "#EAF0F6",
  late: "#8C4A24",
  lateBg: "#F6EBE3",
  pending: "#7A6328",
  pendingBg: "#F3EDD8",
  approvedBg: "#E5F0EA",
  danger: "#6E2430",
  dangerBg: "#F7E8EA",
  onForest: "#FFFFFF",
  // iOS systemGray4, behind the compact date and time chips.
  chip: "#C7C7CC",
  scrim: "rgba(20, 38, 31, 0.32)",
  shadow: "#14261F",
};

export const dark: HallColors = {
  ink: "#E8EEE9",
  inkSoft: "#A8B5AD",
  inkFaint: "#7A8A80",
  forest: "#3D8F6E",
  forestDeep: "#2F6F56",
  leaf: "#4CA882",
  gold: "#D4B56A",
  goldSoft: "#3A3424",
  paper: "#121A16",
  paper2: "#0E1512",
  surface: "#1A2420",
  surfaceRaised: "#222E28",
  line: "#2A3830",
  lineStrong: "#3A4A40",
  outside: "#8AAAC8",
  outsideBg: "#1A2834",
  late: "#E0A078",
  lateBg: "#2E221C",
  pending: "#D4C08A",
  pendingBg: "#2A281C",
  approvedBg: "#1C2E26",
  danger: "#E0707C",
  dangerBg: "#2E1A1E",
  onForest: "#FFFFFF",
  chip: "#3A3A3C",
  scrim: "rgba(8, 12, 10, 0.62)",
  shadow: "#000000",
};

/** Night gate. Always this shell, in light mode and dark. */
export const gate = {
  bg: "#101C17",
  panel: "#18261F",
  ink: "#EEF2EC",
  muted: "#9AA89E",
  gold: "#D7C48A",
  danger: "#C45A64",
  scrim: "rgba(20, 38, 31, 0.45)",
} as const;

export function useHallColors(): HallColors {
  return useDark() ? dark : light;
}
