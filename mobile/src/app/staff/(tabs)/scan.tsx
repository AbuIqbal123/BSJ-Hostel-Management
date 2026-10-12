import { useCallback, useEffect, useRef, useState } from "react";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { useFocusEffect } from "expo-router";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HallButton } from "@/components/hall-button";
import { useSession } from "@/session";
import { readScan, trimStop, type ScanResult } from "@/staff";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

const RESULT_MS = 5000;

function refusal(message: string, details: Record<string, unknown> | null): ScanResult {
  const name = typeof details?.full_name === "string" ? details.full_name : "";
  const room = typeof details?.room_label === "string" ? details.room_label : "";
  return { kind: "refused", name, room, line: trimStop(message), time: "" };
}

function ResultCard({ result, onDismiss }: { result: ScanResult; onDismiss: () => void }) {
  const colors = useHallColors();
  const refused = result.kind === "refused";
  const tone = refused
    ? { color: colors.danger, background: colors.dangerBg }
    : { color: colors.forest, background: colors.approvedBg };
  const pill = refused ? "Refused" : result.kind === "leave" ? "Leave" : "Return";
  const who = [result.name, result.room].filter(Boolean).join(" · ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${pill}. ${who}. ${result.line}`}
      onPress={onDismiss}
      style={[styles.card, { backgroundColor: colors.paper }]}
    >
      <View style={styles.cardTop}>
        <Text numberOfLines={1} style={[text.hallName, styles.cardTitle, { color: colors.ink }]}>
          {refused ? "Not recorded" : result.name}
        </Text>
        <View style={[styles.pill, { borderColor: tone.color, backgroundColor: tone.background }]}>
          <Text style={[styles.pillText, { color: tone.color }]}>{pill}</Text>
        </View>
      </View>
      {refused ? (
        <Text numberOfLines={3} style={[text.body, { color: colors.ink }]}>
          {result.line}
        </Text>
      ) : null}
      <Text numberOfLines={1} style={[text.body, { color: colors.inkSoft }]}>
        {refused ? who : [result.room, result.line].filter(Boolean).join(" · ")}
      </Text>
      {result.time ? (
        <Text numberOfLines={1} style={[text.mono, { color: colors.ink }]}>
          {result.time}
        </Text>
      ) : null}
    </Pressable>
  );
}

export default function ScanScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const [focused, setFocused] = useState(false);
  const { staffRequest } = useSession();
  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState<ScanResult | null>(null);
  const busy = useRef(false);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  useEffect(() => {
    if (!result) {
      return;
    }
    const timer = setTimeout(() => setResult(null), RESULT_MS);
    return () => clearTimeout(timer);
  }, [result]);

  const onScanned = useCallback(
    async ({ data }: BarcodeScanningResult) => {
      if (busy.current || result) {
        return;
      }
      busy.current = true;
      const reply = await staffRequest("/gate/scans", { qr_payload: data });
      busy.current = false;
      if (reply.ok) {
        setResult(readScan(reply.data) ?? refusal("The hall could not read that scan", null));
      } else {
        setResult(refusal(reply.message, reply.details));
      }
    },
    [result, staffRequest],
  );

  if (!permission) {
    return <View style={[styles.screen, { backgroundColor: colors.paper }]} />;
  }
  if (!permission.granted) {
    return (
      <View style={[styles.screen, styles.ask, { backgroundColor: colors.paper, paddingTop: insets.top }]}>
        <Text style={[text.hallName, { color: colors.ink }]}>Scan a hall pass</Text>
        <Text style={[text.body, styles.center, { color: colors.inkSoft }]}>
          The camera reads the code on a resident&apos;s pass
        </Text>
        {permission.canAskAgain ? (
          <HallButton label="Allow camera" onPress={() => void requestPermission()} />
        ) : (
          <HallButton label="Open Settings" onPress={() => void Linking.openSettings()} />
        )}
      </View>
    );
  }

  return (
    <View style={[styles.screen, styles.dark]}>
      {focused ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={result ? undefined : (scan) => void onScanned(scan)}
        />
      ) : null}
      {result ? (
        <View style={styles.result}>
          <ResultCard result={result} onDismiss={() => setResult(null)} />
        </View>
      ) : (
        <Text style={[text.body, styles.hint, { top: insets.top + 28 }]}>Point the camera at a hall pass</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  dark: { backgroundColor: "#000000" },
  ask: { justifyContent: "center", paddingHorizontal: 28, gap: 16 },
  center: { textAlign: "center" },
  hint: { position: "absolute", left: 28, right: 28, textAlign: "center", color: "#F2F4F0" },
  result: { position: "absolute", left: 12, right: 12, bottom: 12 },
  card: {
    borderRadius: 22,
    borderCurve: "continuous",
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 6,
    shadowColor: "#14261F",
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 4,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  cardTitle: { flex: 1, textAlign: "left" },
  pill: { borderWidth: 1, borderRadius: 8, borderCurve: "continuous", paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontFamily: "SourceSans3_600SemiBold", fontSize: 13, lineHeight: 18 },
});
