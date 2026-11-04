import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import QRCode from "react-native-qrcode-svg";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatWhen, formatWhenParts } from "@/format-when";
import { useSession, type DestinationItem, type HallPass } from "@/session";
import { useDark } from "@/theme/appearance";
import { useHallColors } from "@/theme/colors";
import { EASE_OUT } from "@/theme/motion";
import { text } from "@/theme/text";

const FADE_MS = 220;
const BORDER_MS = 3600;
const PULSE_MS = 1600;
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
const INSET = 4;
const RADIUS = 18;
const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Perimeter of a rounded square: four shortened sides + one full circle of corners. */
function borderLength(side: number, radius: number): number {
  return 4 * (side - 2 * radius) + 2 * Math.PI * radius;
}

/** Clockwise rounded rect; Z closes with no extra length so the dash loop has no open-path seam. */
function roundedRectPath(x: number, y: number, side: number, radius: number): string {
  const r = radius;
  const right = x + side;
  const bottom = y + side;
  return [
    `M ${x + r} ${y}`,
    `H ${right - r}`,
    `A ${r} ${r} 0 0 1 ${right} ${y + r}`,
    `V ${bottom - r}`,
    `A ${r} ${r} 0 0 1 ${right - r} ${bottom}`,
    `H ${x + r}`,
    `A ${r} ${r} 0 0 1 ${x} ${bottom - r}`,
    `V ${y + r}`,
    `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
    "Z",
  ].join(" ");
}

function shownPlace(
  place: string | null,
  places: DestinationItem[] | null,
): { title: string; where: string | null } | null {
  if (!place) {
    return null;
  }
  const other = places?.find((item) => item.other);
  if (!other || places?.some((item) => !item.other && item.name === place)) {
    return { title: place, where: null };
  }
  return { title: other.name, where: place === other.name ? null : place };
}

function PassCode({ value, size }: { value: string; size: number }) {
  const colors = useHallColors();
  const dark = useDark();
  const reduced = useReducedMotion();
  const opacity = useSharedValue(0);
  const travel = useSharedValue(0);
  const pulse = useSharedValue(1);
  const faded = useRef<string | null>(null);
  // Integer frame keeps SVG dash math and corner joins aligned to device pixels.
  const frame = Math.round(size + BORDER * 2);
  const qrSize = frame - BORDER * 2;
  const side = frame - INSET * 2;
  const length = borderLength(side, RADIUS);
  const path = useMemo(() => roundedRectPath(INSET, INSET, side, RADIUS), [side]);
  // Soft comet: wide translucent body + shorter bright head. Dash + gap = exact perimeter.
  const bodyDash = length * 0.2;
  const bodyGap = length - bodyDash;
  const headDash = length * 0.08;
  const headGap = length - headDash;
  const headLead = bodyDash - headDash;
  const trackStroke = dark ? colors.forest : colors.line;
  const bodyStroke = colors.forest;
  const headStroke = dark ? colors.pending : colors.forestDeep;
  const trackPulse = dark ? 0.45 : 0.3;

  useEffect(() => {
    if (faded.current === value) {
      return;
    }
    faded.current = value;
    opacity.value = 0;
    opacity.value = withTiming(1, { duration: FADE_MS, easing: EASE_OUT });
  }, [opacity, value]);

  useFocusEffect(
    useCallback(() => {
      void activateKeepAwakeAsync(AWAKE);
      if (reduced) {
        travel.value = 0;
        pulse.value = 1;
        return () => {
          void deactivateKeepAwake(AWAKE);
        };
      }
      travel.value = 0;
      travel.value = withRepeat(
        withTiming(1, { duration: BORDER_MS, easing: Easing.linear }),
        -1,
        false,
      );
      pulse.value = withRepeat(
        withSequence(
          withTiming(0.55, { duration: PULSE_MS, easing: EASE_OUT }),
          withTiming(1, { duration: PULSE_MS, easing: EASE_OUT }),
        ),
        -1,
        false,
      );
      return () => {
        cancelAnimation(travel);
        cancelAnimation(pulse);
        void deactivateKeepAwake(AWAKE);
      };
    }, [pulse, reduced, travel]),
  );

  const shellStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const trackProps = useAnimatedProps(() => ({
    strokeOpacity: 0.35 + pulse.value * trackPulse,
  }));
  const bodyProps = useAnimatedProps(() => ({
    strokeDashoffset: -travel.value * length,
  }));
  // Bright tip sits on the leading end of the soft body.
  const headProps = useAnimatedProps(() => ({
    strokeDashoffset: -travel.value * length - headLead,
  }));

  return (
    <Animated.View
      style={[
        styles.code,
        {
          width: frame,
          height: frame,
          shadowColor: dark ? "#000000" : colors.ink,
          shadowOpacity: dark ? 0.45 : 0.14,
        },
        shellStyle,
      ]}
      accessibilityLabel="Hall pass"
    >
      <Svg width={frame} height={frame} style={styles.border}>
        <AnimatedPath
          d={path}
          fill="none"
          stroke={trackStroke}
          strokeWidth={dark ? 3 : 2}
          strokeLinecap="round"
          strokeLinejoin="round"
          animatedProps={trackProps}
        />
        {reduced ? (
          <Path
            d={path}
            fill="none"
            stroke={bodyStroke}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${headDash} ${headGap}`}
            strokeDashoffset={0}
            opacity={dark ? 0.9 : 0.85}
          />
        ) : (
          <>
            <AnimatedPath
              d={path}
              fill="none"
              stroke={bodyStroke}
              strokeWidth={dark ? 5 : 4}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${bodyDash} ${bodyGap}`}
              opacity={dark ? 0.45 : 0.28}
              animatedProps={bodyProps}
            />
            <AnimatedPath
              d={path}
              fill="none"
              stroke={headStroke}
              strokeWidth={dark ? 3.5 : 2.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${headDash} ${headGap}`}
              opacity={dark ? 1 : 0.95}
              animatedProps={headProps}
            />
          </>
        )}
      </Svg>
      <QRCode
        value={value}
        size={qrSize}
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
  const [places, setPlaces] = useState<DestinationItem[] | null>(null);
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
      setPlaces(result.items);
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
  const place = shownPlace(pass?.place ?? null, places);
  const quiet = 16;
  const codeSize = Math.max(0, width - 28 * 2 - quiet * 2 - BORDER * 2);
  const codeFrame = Math.round(codeSize + BORDER * 2);

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
            Show this pass to the gate staff
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
            <Text accessibilityLiveRegion="polite" style={[text.error, styles.center, { color: colors.danger }]}>The pass didn't load</Text>
          ) : null}
          {empty ? (
            <Text style={[text.body, styles.center, { color: colors.inkSoft }]}>No pass right now</Text>
          ) : null}
          {before ? (
            <View style={styles.note}>
              <Text style={[text.body, styles.center, { color: colors.ink }]}>{waitingTitle(pass?.outingType)}</Text>
              <Text style={[text.body, styles.center, { color: colors.ink }]}>
                {`Your QR code appears at ${formatWhen(before)}`}
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

function waitingTitle(type: HallPass["outingType"] | undefined): string {
  if (type === "late_night") {
    return "You have an approved late-night permission";
  }
  if (type === "home_going") {
    return "You have an approved home-going permission";
  }
  return "You have a planned outing";
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
