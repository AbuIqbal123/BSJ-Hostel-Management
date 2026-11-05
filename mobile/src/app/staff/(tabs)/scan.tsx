import React, { useCallback, useEffect, useRef, useState } from "react";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Linking, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import Reanimated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HallButton } from "@/components/hall-button";
import { ignore } from "@/safe";
import { useSession } from "@/session";
import { readScan, scanRefusal, type ScanResult } from "@/staff";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

const SAME_CODE_MS = 1500;
/** Hold the result so staff can read it, then clear so the next pass is ready. */
const RESULT_HOLD_MS = 30_000;
const TICK_MS = 180;
/** First frame is already a visible check. The settle runs from here to full size. */
const TICK_FROM = 0.45;
const DIM = "rgba(20, 38, 31, 0.45)";
const LIGHT = "#F2F4F0";

function buzz(ok: boolean) {
  const type = ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error;
  Haptics.notificationAsync(type).catch(ignore);
}

const CORNER = 44;
const STROKE = 4;
/** Soft outer bend — matches the design-system corner language. */
const BEND = 14;

/** L-shaped bracket with a curved outer corner. */
function Corner({ color, at }: { color: string; at: "tl" | "tr" | "bl" | "br" }) {
  const top = at[0] === "t";
  const left = at[1] === "l";
  return (
    <View
      pointerEvents="none"
      style={[
        styles.corner,
        { borderColor: color },
        top ? { top: 0, borderTopWidth: STROKE } : { bottom: 0, borderBottomWidth: STROKE },
        left ? { left: 0, borderLeftWidth: STROKE } : { right: 0, borderRightWidth: STROKE },
        top && left ? { borderTopLeftRadius: BEND } : null,
        top && !left ? { borderTopRightRadius: BEND } : null,
        !top && left ? { borderBottomLeftRadius: BEND } : null,
        !top && !left ? { borderBottomRightRadius: BEND } : null,
      ]}
    />
  );
}

function Viewfinder({
  size,
  color,
  camera,
  seatResult,
  children,
}: {
  size: number;
  color: string;
  camera: React.ReactNode;
  /** A result card is in the lower band. Keep that band above the preview. */
  seatResult?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={[styles.dim, { flex: 1 }]} />
      <View style={[styles.finderRow, { height: size }]}>
        <View style={[styles.dim, { flex: 1 }]} />
        <View style={[styles.frame, { width: size, height: size }]}>
          {camera}
          {(["tl", "tr", "bl", "br"] as const).map((at) => (
            <Corner key={at} at={at} color={color} />
          ))}
        </View>
        <View style={[styles.dim, { flex: 1 }]} />
      </View>
      <View
        style={[styles.dim, styles.below, seatResult ? styles.belowSeat : null]}
        pointerEvents="box-none"
        collapsable={!seatResult}
      >
        {children}
      </View>
    </View>
  );
}

function SuccessTick({ color }: { color: string }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(reduced ? 1 : TICK_FROM);
  useEffect(() => {
    if (reduced) {
      scale.set(1);
      return;
    }
    scale.set(
      withTiming(1, {
        duration: TICK_MS,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [reduced, scale]);
  const motion = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));
  return (
    <Reanimated.View accessible={false} importantForAccessibility="no" style={motion}>
      <Ionicons name="checkmark-circle" size={32} color={color} />
    </Reanimated.View>
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
  const reduced = useReducedMotion();
  const rise = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      rise.set(1);
      return;
    }
    rise.set(
      withTiming(1, {
        duration: 140,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [reduced, rise]);
  const cardIn = useAnimatedStyle(() => ({
    opacity: rise.get(),
    transform: [{ translateY: (1 - rise.get()) * 24 }],
  }));
  useEffect(() => {
    if (!result) {
      return;
    }
    const clear = setTimeout(onNext, RESULT_HOLD_MS);
    return () => clearTimeout(clear);
  }, [result, onNext]);
  const refused = result?.kind === "refused";
  const success = result !== null && !refused;
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
  const mark = !result ? "ellipsis-horizontal-circle" : refused ? "close-circle" : "checkmark-circle";
  return (
    <Reanimated.View style={[styles.result, cardIn]}>
      <View
        accessibilityLiveRegion="polite"
        accessibilityLabel={spoken.filter(Boolean).join(". ")}
        style={[styles.card, { backgroundColor: refused ? colors.dangerBg : colors.paper }]}
      >
        <View style={styles.wordRow}>
          {success ? <SuccessTick color={tone} /> : <Ionicons name={mark} size={32} color={tone} />}
          <Text style={[styles.word, { color: tone, flex: 1 }]}>{word}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            disabled={!result}
            hitSlop={12}
            onPress={onNext}
            style={({ pressed }) => [styles.dismiss, !result && styles.dismissIdle, pressed && result && styles.pressed]}
          >
            <Ionicons name="close" size={22} color={result ? colors.inkSoft : colors.inkFaint} />
          </Pressable>
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
    </Reanimated.View>
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
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { staffRequest } = useSession();
  const [permission, requestPermission] = useCameraPermissions();
  const [focused, setFocused] = useState(true);
  const [broken, setBroken] = useState(false);
  const [card, setCard] = useState<Card>(null);
  const last = useRef({ code: "", at: 0 });
  const seq = useRef(0);
  const shown = useRef(false);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(ignore);
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
        {card ? (
          <View style={styles.manualResult}>
            <ResultCard key={card.id} result={card.result} onNext={next} />
          </View>
        ) : null}
      </View>
    );
  }

  // Large guide only. The camera already reads a QR anywhere in the frame.
  // HallTabBar is 52 plus the bottom inset and 10. Leave that, plus a result band, so the check is not under the preview.
  const tabBar = 52 + insets.bottom + 10;
  const resultBand = card ? 200 : 64;
  const size = Math.min(
    width - 40,
    Math.round(width * (card ? 0.72 : 0.88)),
    Math.max(140, height - tabBar - resultBand),
  );
  return (
    <View style={[styles.screen, styles.dark]}>
      <View style={[StyleSheet.absoluteFill, { paddingTop: insets.top }]} pointerEvents="box-none">
        <Viewfinder
          size={size}
          seatResult={card !== null}
          color={card ? colors.forest : LIGHT}
          camera={
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              active={focused}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onMountError={() => setBroken(true)}
              onBarcodeScanned={
                focused && !card ? (scan: BarcodeScanningResult) => void submit(scan.data) : undefined
              }
            />
          }
        >
          {card ? (
            <ResultCard key={card.id} result={card.result} onNext={next} />
          ) : (
            <Text style={styles.hint}>Point the camera at the hall pass</Text>
          )}
        </Viewfinder>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  dark: { backgroundColor: "#000000" },
  ask: { justifyContent: "center", paddingHorizontal: 28, gap: 16 },
  center: { textAlign: "center" },
  dim: { backgroundColor: DIM },
  /** Clips the live preview to the same soft bend as the corner brackets. */
  frame: { borderRadius: BEND, borderCurve: "continuous", overflow: "hidden" },
  finderRow: { flexDirection: "row" },
  corner: { position: "absolute", width: CORNER, height: CORNER },
  below: {
    flexGrow: 1.3,
    flexShrink: 1.3,
    flexBasis: 0,
    alignItems: "stretch",
    justifyContent: "flex-start",
    paddingTop: 16,
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 16,
  },
  /** Paint the result over the preview, and do not let this band shrink to nothing. */
  belowSeat: { flexShrink: 0, minHeight: 96, zIndex: 2, elevation: 4 },
  hint: {
    alignSelf: "center",
    fontFamily: "SourceSans3_400Regular",
    fontSize: 15,
    lineHeight: 20,
    color: LIGHT,
    opacity: 0.85,
  },
  result: { alignSelf: "stretch" },
  manualResult: { paddingHorizontal: 12, paddingBottom: 12 },
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
  dismiss: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -6,
  },
  dismissIdle: { opacity: 0.35 },
  pressed: { opacity: 0.6 },
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
