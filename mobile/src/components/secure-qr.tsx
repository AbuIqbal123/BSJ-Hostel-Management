import { useMemo } from "react";
import { Platform, type ViewProps } from "react-native";
import { requireNativeView, requireOptionalNativeModule } from "expo";
import QRCode from "react-native-qrcode-svg";

import { qrCells } from "@/qr-cells";
import { light } from "@/theme/colors";

const QUIET = 16;

type NativeProps = ViewProps & {
  cells: string;
  count: number;
  size: number;
  quiet: number;
};

const NativeSecureQr =
  Platform.OS === "web" || requireOptionalNativeModule("SecureQr") == null
    ? null
    : requireNativeView<NativeProps>("SecureQr");

export function SecureQr({ value, size }: { value: string; size: number }) {
  const cells = useMemo(() => qrCells(value), [value]);
  if (!NativeSecureQr || !cells) {
    return (
      <QRCode value={value} size={size} color={light.ink} backgroundColor={light.surface} quietZone={QUIET} />
    );
  }
  return (
    <NativeSecureQr
      accessible={false}
      cells={cells.bits}
      count={cells.count}
      quiet={QUIET}
      size={size}
      style={{ width: size, height: size, backgroundColor: light.surface }}
    />
  );
}
