import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { Animated, Easing, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import Svg, { Rect } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatWhen } from "@/format-when";
import { useSession, type HallPass } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

const FADE_MS = 220;
const BORDER_MS = 3200;
const AWAKE = "hall-pass";
const BORDER = 14;
const AnimatedRect = Animated.createAnimatedComponent(Rect);

function borderLength(frame: number): number {
  const stroke = 2;
  const radius = 18;
  const side = frame - stroke;
  return 2 * (side + side - radius * 2) + 2 * Math.PI * radius;
}

function PassCode({ value, size }: { value: string; size: number }) {
  const colors = useHallColors();
  const opacity = useRef(new Animated.Value(0)).current;
  const travel = useRef(new Animated.Value(0)).current;
  const faded = useRef<string | null>(null);
  const frame = size + BORDER * 2;
  const length = borderLength(frame);

  useEffect(() => {
    if (faded.current === value) {
      return;
    }
    faded.current = value;
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: FADE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [opacity, value]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(travel, {
        toValue: 1,
        duration: BORDER_MS,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [travel]);

  useEffect(() => {
    void activateKeepAwakeAsync(AWAKE);
    return () => {
      void deactivateKeepAwake(AWAKE);
    };
  }, []);

  const offset = travel.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -length],
  });

  return (
    <Animated.View style={[styles.code, { width: frame, height: frame, opacity }]} accessibilityLabel="Hall pass">
      <Svg width={frame} height={frame} style={styles.border}>
        <Rect
          x={1}
          y={1}
          width={frame - 2}
          height={frame - 2}
          rx={18}
          fill="none"
          stroke={colors.line}
          strokeWidth={1}
        />
        <AnimatedRect
          x={1}
          y={1}
          width={frame - 2}
          height={frame - 2}
          rx={18}
          fill="none"
          stroke={colors.forest}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={`${Math.round(length * 0.18)} ${Math.round(length * 0.82)}`}
          strokeDashoffset={offset}
        />
      </Svg>
      <QRCode
        value={value}
        size={size}
        color="#000000"
        backgroundColor="#FFFFFF"
        quietZone={16}
      />
    </Animated.View>
  );
}

export default function HallPassScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { loadHallPass } = useSession();
  const [pass, setPass] = useState<HallPass | null>(null);
  const [failed, setFailed] = useState(false);
  const loadHallPassRef = useRef(loadHallPass);
  loadHallPassRef.current = loadHallPass;

  const load = useCallback(() => {
    let active = true;
    void loadHallPassRef.current().then((result) => {
      if (!active) {
        return;
      }
      if (result.error !== null) {
        setPass(null);
        setFailed(true);
        return;
      }
      setFailed(false);
      setPass(result.pass);
    });
    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(load);

  useEffect(() => {
    if (!pass) {
      return;
    }
    const boundary = pass.qrVisible ? pass.qrVisibleUntil : pass.qrVisibleFrom;
    if (!boundary) {
      return;
    }
    const at = new Date(boundary).getTime() - Date.now();
    if (Number.isNaN(at) || at <= 0) {
      return;
    }
    const timer = setTimeout(() => {
      load();
    }, at);
    return () => clearTimeout(timer);
  }, [load, pass]);

  const room = pass && pass.roomLabel.length > 0 ? pass.roomLabel : null;
  const code = pass?.qrVisible && pass.qrPayload ? pass.qrPayload : null;
  const before = pass && !pass.qrVisible && pass.qrVisibleFrom ? pass.qrVisibleFrom : null;
  const empty = pass !== null && code === null && before === null;
  const quiet = 16;
  const codeSize = Math.max(0, width - 28 * 2 - quiet * 2 - BORDER * 2);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 },
      ]}
    >
      <View style={styles.block}>
        {pass ? (
          <View style={styles.identity}>
            <Text selectable style={[text.hallName, styles.title, { color: colors.ink }]}>
              {pass.fullName}
            </Text>
            {room ? (
              <Text selectable style={[text.body, { color: colors.inkSoft }]}>
                {room}
              </Text>
            ) : null}
          </View>
        ) : null}
        {failed ? (
          <Text style={[text.error, { color: colors.danger }]}>The pass didn't load.</Text>
        ) : null}
        {empty ? (
          <Text style={[text.body, { color: colors.inkSoft }]}>No pass right now.</Text>
        ) : null}
        {before ? (
          <View style={styles.note}>
            <Text style={[text.body, { color: colors.ink }]}>You have a planned outing.</Text>
            <Text style={[text.body, { color: colors.ink }]}>
              {`Your QR code appears at ${formatWhen(before)}, 30 minutes before you leave.`}
            </Text>
          </View>
        ) : null}
        {code ? (
          <View style={styles.codeBlock}>
            <PassCode value={code} size={codeSize} />
            <Text style={[text.body, { color: colors.ink }]}>
              {pass?.qrVisibleUntil
                ? `Show your QR code until ${formatWhen(pass.qrVisibleUntil)}.`
                : "Show your QR code until you are back."}
            </Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 28,
  },
  block: { gap: 28 },
  identity: { gap: 16 },
  title: { textAlign: "left" },
  note: { gap: 12 },
  codeBlock: { gap: 16, alignItems: "center" },
  code: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderCurve: "continuous",
  },
  border: {
    position: "absolute",
    top: 0,
    left: 0,
  },
});
