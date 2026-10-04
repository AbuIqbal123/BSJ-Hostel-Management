import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import Svg, { Rect } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatWhen, formatWhenParts } from "@/format-when";
import { OTHER_NAME } from "@/outing-when";
import { useSession, type HallPass } from "@/session";
import { useDark } from "@/theme/appearance";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

const FADE_MS = 220;
const BORDER_MS = 3200;
function Fact({
  label,
  value,
  detail,
  edge,
}: {
  label: string;
  value: string;
  detail?: string | null;
  edge: "left" | "right";
}) {
  const colors = useHallColors();
  const right = edge === "right";
  return (
    <View style={[styles.fact, right ? styles.factRight : styles.factLeft]}>
      <Text style={[text.label, right ? styles.right : null, { color: colors.inkFaint }]}>{label}</Text>
      <Text style={[text.body, right ? styles.right : null, { color: colors.ink }]}>{value}</Text>
      {detail ? (
        <Text style={[text.body, right ? styles.right : null, { color: colors.inkSoft }]}>{detail}</Text>
      ) : null}
    </View>
  );
}

const AWAKE = "hall-pass";
const BORDER = 16;
const FOREST = 4;
const AnimatedRect = Animated.createAnimatedComponent(Rect);

function borderLength(frame: number): number {
  const inset = FOREST;
  const radius = 18;
  const side = frame - inset * 2;
  return 2 * (side + side - radius * 2) + 2 * Math.PI * radius;
}

function shownPlace(
  place: string | null,
  names: string[] | null,
): { title: string; where: string | null } | null {
  if (!place) {
    return null;
  }
  if (!names || (names.includes(place) && place !== OTHER_NAME)) {
    return { title: place, where: null };
  }
  return { title: OTHER_NAME, where: place === OTHER_NAME ? null : place };
}

function PassCode({ value, size }: { value: string; size: number }) {
  const colors = useHallColors();
  const dark = useDark();
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
    <Animated.View
      style={[
        styles.code,
        {
          width: frame,
          height: frame,
          opacity,
          shadowColor: dark ? "#000000" : colors.ink,
          shadowOpacity: dark ? 0.45 : 0.14,
        },
      ]}
      accessibilityLabel="Hall pass"
    >
      <Svg width={frame} height={frame} style={styles.border}>
        <Rect
          x={FOREST}
          y={FOREST}
          width={frame - FOREST * 2}
          height={frame - FOREST * 2}
          rx={18}
          fill="none"
          stroke={colors.line}
          strokeWidth={2}
        />
        <AnimatedRect
          x={FOREST}
          y={FOREST}
          width={frame - FOREST * 2}
          height={frame - FOREST * 2}
          rx={18}
          fill="none"
          stroke={colors.forest}
          strokeWidth={FOREST}
          strokeLinecap="round"
          strokeDasharray={`${Math.round(length * 0.22)} ${Math.round(length * 0.78)}`}
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
  const { loadHallPass, loadDestinations } = useSession();
  const [pass, setPass] = useState<HallPass | null>(null);
  const [names, setNames] = useState<string[] | null>(null);
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
    void loadDestinations().then((result) => {
      if (!active || result.error !== null) {
        return;
      }
      setNames(result.items.map((item) => item.name));
    });
    return () => {
      active = false;
    };
  }, [loadDestinations]);

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
  const place = shownPlace(pass?.place ?? null, names);
  const quiet = 16;
  const codeSize = Math.max(0, width - 28 * 2 - quiet * 2 - BORDER * 2);
  const codeFrame = codeSize + BORDER * 2;

  const due = pass ? returnBy(pass) : null;
  const who = pass ? (
    <View style={styles.whoLine}>
      <Text selectable style={[styles.name, { color: colors.ink }]}>
        {pass.fullName}
      </Text>
      {room ? (
        <Text selectable style={[styles.room, { color: colors.inkFaint }]}>
          {`·  ${room}`}
        </Text>
      ) : null}
    </View>
  ) : null;

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: colors.paper, paddingTop: insets.top + 12, paddingBottom: 12 },
      ]}
    >
      {code && pass && due ? (
        <View style={styles.stage}>
          {who}
          <PassCode value={code} size={codeSize} />
          <Text style={[text.body, styles.center, { color: colors.inkSoft }]}>
            Show this pass to the gate staff.
          </Text>
          <View style={[styles.facts, { width: codeFrame }]}>
            {place ? (
              <Fact label="Destination" value={place.title} detail={place.where} edge="left" />
            ) : null}
            <Fact label="Return by" value={due.value} detail={due.detail} edge="right" />
          </View>
        </View>
      ) : (
        <View style={[styles.stage, styles.waiting]}>
          {who}
          {failed ? (
            <Text style={[text.error, styles.center, { color: colors.danger }]}>The pass didn't load.</Text>
          ) : null}
          {empty ? (
            <Text style={[text.body, styles.center, { color: colors.inkSoft }]}>No pass right now.</Text>
          ) : null}
          {before ? (
            <View style={styles.note}>
              <Text style={[text.body, styles.center, { color: colors.ink }]}>You have a planned outing.</Text>
              <Text style={[text.body, styles.center, { color: colors.ink }]}>
                {`Your QR code appears at ${formatWhen(before)}, 30 minutes before you leave.`}
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

function returnBy(pass: HallPass): { value: string; detail: string | null } {
  const iso = pass.expectedReturnAt ?? pass.qrVisibleUntil;
  if (!iso) {
    return { value: "When you are back", detail: null };
  }
  const parts = formatWhenParts(iso);
  if (!parts) {
    return { value: formatWhen(iso), detail: null };
  }
  return { value: parts.clock, detail: parts.day };
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  stage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 16,
  },
  waiting: { gap: 16 },
  whoLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontFamily: "SourceSerif4_600SemiBold",
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.4,
  },
  room: {
    fontFamily: "IBMPlexMono_500Medium",
    fontSize: 15,
    lineHeight: 18,
    marginLeft: 8,
  },
  note: { gap: 4, alignSelf: "stretch" },
  facts: {
    flexDirection: "row",
    gap: 20,
  },
  fact: { flex: 1, gap: 2 },
  factLeft: { alignItems: "flex-start" },
  factRight: { alignItems: "flex-end" },
  right: { textAlign: "right" },
  center: { textAlign: "center" },
  code: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderCurve: "continuous",
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 4,
  },
  border: {
    position: "absolute",
    top: 0,
    left: 0,
  },
});
