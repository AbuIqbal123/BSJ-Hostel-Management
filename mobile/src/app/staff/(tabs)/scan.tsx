import React, { useCallback, useEffect, useRef, useState } from "react";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Animated, Linking, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HallButton } from "@/components/hall-button";
import { useSession } from "@/session";
import { readScan, scanRefusal, type ScanResult } from "@/staff";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

const SAME_CODE_MS = 2000;
const DIM = "rgba(20, 38, 31, 0.62)";
const LIGHT = "#F2F4F0";

function buzz(ok: boolean) {
  const type = ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error;
  Haptics.notificationAsync(type).catch(() => undefined);
}

function Corner({ color, at }: { color: string; at: "tl" | "tr" | "bl" | "br" }) {
  const top = at[0] === "t";
  const left = at[1] === "l";
  return (
    <View
      style={[
        styles.corner,
        top ? { top: -2, borderTopWidth: 4 } : { bottom: -2, borderBottomWidth: 4 },
        left ? { left: -2, borderLeftWidth: 4 } : { right: -2, borderRightWidth: 4 },
        top && left ? { borderTopLeftRadius: 26 } : null,
        top && !left ? { borderTopRightRadius: 26 } : null,
        !top && left ? { borderBottomLeftRadius: 26 } : null,
        !top && !left ? { borderBottomRightRadius: 26 } : null,
        { borderColor: color },
      ]}
    />
  );
}

function Viewfinder({ size, color, children }: { size: number; color: string; children?: React.ReactNode }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={[styles.dim, { flex: 1 }]} />
      <View style={{ flexDirection: "row", height: size }}>
        <View style={[styles.dim, { flex: 1 }]} />
        <View style={[styles.frame, { width: size, height: size }]}>
          {(["tl", "tr", "bl", "br"] as const).map((at) => (
            <Corner key={at} at={at} color={color} />
          ))}
        </View>
        <View style={[styles.dim, { flex: 1 }]} />
      </View>
      <View style={[styles.dim, styles.below]} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}

function Fact({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  const colors = useHallColors();
  return (
    <View style={styles.fact}>
      <Text style={[styles.factLabel, { color: colors.inkFaint }]}>{label}</Text>
      <Text numberOfLines={1} style={[styles.factValue, { color: danger ? colors.danger : colors.ink }]}>
        {value}
      </Text>
    </View>
  );
}

function ResultCard({ result, onNext }: { result: ScanResult | null; onNext: () => void }) {
  const colors = useHallColors();
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(rise, { toValue: 1, duration: 140, useNativeDriver: true }).start();
  }, [rise]);
  const lift = rise.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const refused = result?.kind === "refused";
  const word = !result ? "Recording" : refused ? "Not recorded" : result.kind === "leave" ? "Leave" : "Return";
  const tone = !result ? colors.inkFaint : refused ? colors.danger : colors.forest;
  const secondary = result ? [result.room, result.outing, result.place].filter(Boolean).join(" · ") : "";
  const facts = result?.facts ?? [];
  const spoken = [
    word,
    result?.name,
    secondary,
    result?.reason,
    ...facts.map((f) => `${f.label} ${f.value}`),
    result?.timeliness,
  ];
  return (
    <Animated.View style={[styles.result, { opacity: rise, transform: [{ translateY: lift }] }]}>
      <View
        accessibilityLiveRegion="polite"
        accessibilityLabel={spoken.filter(Boolean).join(". ")}
        style={[styles.card, { backgroundColor: refused ? colors.dangerBg : colors.paper }]}
      >
        <View style={styles.wordRow}>
          <Ionicons
            name={!result ? "ellipsis-horizontal-circle" : refused ? "close-circle" : "checkmark-circle"}
            size={32}
            color={tone}
          />
          <Text style={[styles.word, { color: tone }]}>{word}</Text>
        </View>
        {result?.name || secondary ? (
          <View style={styles.who}>
            {result?.name ? (
              <Text numberOfLines={1} style={[styles.name, { color: colors.ink }]}>
                {result.name}
              </Text>
            ) : null}
            {secondary ? (
              <Text numberOfLines={2} style={[styles.secondary, { color: colors.inkSoft }]}>
                {secondary}
              </Text>
            ) : null}
          </View>
        ) : null}
        {result?.reason ? <Text style={[styles.reason, { color: colors.danger }]}>{result.reason}</Text> : null}
        {facts.length || result?.timeliness ? (
          <View style={[styles.facts, { borderTopColor: refused ? colors.danger : colors.line }]}>
            {facts.map((f) => (
              <Fact key={f.label} label={f.label} value={f.value} />
            ))}
            {result?.timeliness ? <Fact label="Status" value={result.timeliness} danger={result.late} /> : null}
          </View>
        ) : null}
        <HallButton label="Scan next" disabled={!result} onPress={onNext} />
      </View>
    </Animated.View>
  );
}

function ManualEntry({ onSubmit, busy }: { onSubmit: (code: string) => void; busy: boolean }) {
  const colors = useHallColors();
  const [code, setCode] = useState("");
  const ready = code.trim().length > 0 && !busy;
  return (
    <View style={styles.manual}>
      <TextInput
        testID="scan-code"
        value={code}
        onChangeText={setCode}
        placeholder="Hall pass code"
        placeholderTextColor={colors.inkFaint}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="go"
        onSubmitEditing={() => ready && onSubmit(code.trim())}
        style={[
          styles.input,
          {
            color: colors.ink,
            borderColor: colors.line,
            backgroundColor: colors.surface,
          },
        ]}
      />
      <HallButton label="Record" disabled={!ready} onPress={() => onSubmit(code.trim())} />
    </View>
  );
}

function NoCamera(props: {
  denied: boolean;
  canAsk: boolean;
  onAsk: () => void;
  onSubmit: (code: string) => void;
  busy: boolean;
}) {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, styles.ask, { backgroundColor: colors.paper, paddingTop: insets.top }]}>
      <Text style={[text.hallName, { color: colors.ink }]}>
        {props.denied ? "Camera is off" : "Camera unavailable"}
      </Text>
      <Text style={[text.body, styles.center, { color: colors.inkSoft }]}>
        {props.denied
          ? "Allow the camera to scan hall passes, or type the hall pass code"
          : "Type the hall pass code to record a leave or return"}
      </Text>
      {props.denied ? (
        props.canAsk ? (
          <HallButton label="Allow camera" onPress={props.onAsk} />
        ) : (
          <HallButton label="Open settings" onPress={() => void Linking.openSettings()} />
        )
      ) : null}
      <ManualEntry onSubmit={props.onSubmit} busy={props.busy} />
    </View>
  );
}

type Card = { id: number; result: ScanResult | null } | null;

export default function ScanScreen() {
  const colors = useHallColors();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { staffRequest } = useSession();
  const [permission, requestPermission] = useCameraPermissions();
  const [focused, setFocused] = useState(true);
  const [torch, setTorch] = useState(false);
  const [broken, setBroken] = useState(false);
  const [card, setCard] = useState<Card>(null);
  const last = useRef({ code: "", at: 0 });
  const seq = useRef(0);
  const shown = useRef(false);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => {
        setFocused(false);
        setTorch(false);
      };
    }, []),
  );

  const submit = useCallback(
    async (data: string) => {
      const now = Date.now();
      if (shown.current || (data === last.current.code && now - last.current.at < SAME_CODE_MS)) {
        return;
      }
      last.current = { code: data, at: now };
      const id = ++seq.current;
      shown.current = true;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      setCard({ id, result: null });
      const reply = await staffRequest("/gate/scans", { qr_payload: data });
      const result = reply.ok
        ? (readScan(reply.data) ?? scanRefusal("The hall could not read that scan", null))
        : scanRefusal(reply.message, reply.details);
      buzz(result.kind !== "refused");
      setCard((shown) => (shown?.id === id ? { id, result } : shown));
    },
    [staffRequest],
  );

  const next = useCallback(() => {
    shown.current = false;
    last.current.at = Date.now();
    setCard(null);
  }, []);

  const reading = card !== null && card.result === null;

  if (!permission) {
    return <View style={[styles.screen, styles.dark]} />;
  }
  if (!permission.granted || broken) {
    return (
      <View style={styles.screen}>
        <NoCamera
          denied={!permission.granted}
          canAsk={permission.canAskAgain}
          onAsk={() => void requestPermission()}
          onSubmit={(code) => void submit(code)}
          busy={reading}
        />
        {card ? <ResultCard key={card.id} result={card.result} onNext={next} /> : null}
      </View>
    );
  }

  const size = Math.min(width - 96, 280);
  return (
    <View style={[styles.screen, styles.dark]}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        active={focused}
        enableTorch={torch && focused}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onMountError={() => setBroken(true)}
        onBarcodeScanned={focused && !card ? (scan: BarcodeScanningResult) => void submit(scan.data) : undefined}
      />
      <View style={[StyleSheet.absoluteFill, { paddingTop: insets.top }]} pointerEvents="box-none">
        <Viewfinder size={size} color={card ? colors.forest : LIGHT}>
          {card ? null : (
            <>
              <Text style={styles.hint}>Point at the hall pass</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={torch ? "Turn torch off" : "Turn torch on"}
                accessibilityState={{ selected: torch }}
                onPress={() => setTorch((on) => !on)}
                style={[styles.torch, torch ? { backgroundColor: LIGHT } : null]}
              >
                <Ionicons
                  name={torch ? "flashlight" : "flashlight-outline"}
                  size={20}
                  color={torch ? colors.ink : LIGHT}
                />
              </Pressable>
            </>
          )}
        </Viewfinder>
      </View>
      {card ? <ResultCard key={card.id} result={card.result} onNext={next} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  dark: { backgroundColor: "#000000" },
  ask: { justifyContent: "center", paddingHorizontal: 28, gap: 16 },
  center: { textAlign: "center" },
  dim: { backgroundColor: DIM },
  frame: { borderRadius: 26 },
  corner: { position: "absolute", width: 44, height: 44 },
  below: { flex: 1.3, alignItems: "center", paddingTop: 20, gap: 20 },
  hint: {
    fontFamily: "SourceSans3_400Regular",
    fontSize: 15,
    lineHeight: 20,
    color: LIGHT,
    opacity: 0.85,
  },
  torch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(242, 244, 240, 0.16)",
  },
  result: { position: "absolute", left: 12, right: 12, bottom: 12 },
  card: {
    borderRadius: 22,
    borderCurve: "continuous",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    gap: 14,
    shadowColor: "#14261F",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 6,
  },
  who: { gap: 2 },
  name: { fontFamily: "SourceSans3_600SemiBold", fontSize: 17, lineHeight: 22 },
  secondary: { fontFamily: "SourceSans3_400Regular", fontSize: 15, lineHeight: 20 },
  facts: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 6 },
  fact: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  factLabel: { fontFamily: "SourceSans3_600SemiBold", fontSize: 13, lineHeight: 18 },
  factValue: { fontFamily: "IBMPlexMono_500Medium", fontSize: 13, lineHeight: 18, flexShrink: 1, textAlign: "right" },
  wordRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  word: {
    fontFamily: "SourceSerif4_600SemiBold",
    fontSize: 30,
    lineHeight: 36,
  },
  reason: {
    fontFamily: "SourceSans3_400Regular",
    fontSize: 15,
    lineHeight: 20,
    marginTop: 2,
  },
  manual: { alignSelf: "stretch", gap: 12, marginTop: 8 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontFamily: "IBMPlexMono_500Medium",
    fontSize: 15,
  },
});
