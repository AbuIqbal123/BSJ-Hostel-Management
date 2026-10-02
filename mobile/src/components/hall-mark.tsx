import { Image } from "react-native";

const MARK_WIDTH = 120;
const MARK_HEIGHT = 119;

export function HallMark({ width = 112 }: { width?: number }) {
  const height = Math.round(width * (MARK_HEIGHT / MARK_WIDTH));

  return (
    <Image
      accessibilityRole="image"
      accessibilityLabel="Aligarh Muslim University"
      source={require("../../assets/amu-seal.png")}
      resizeMode="contain"
      style={{ width, height }}
    />
  );
}
