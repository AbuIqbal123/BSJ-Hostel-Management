import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { Animated, Easing, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatWhen } from "@/format-when";
import { useSession, type HallPass } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

const FADE_MS = 220;
const AWAKE = "hall-pass";

function PassCode({ value, size }: { value: string; size: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const faded = useRef<string | null>(null);

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
    void activateKeepAwakeAsync(AWAKE);
    return () => {
      void deactivateKeepAwake(AWAKE);
    };
  }, []);

  return (
    <Animated.View style={[styles.code, { opacity }]} accessibilityLabel="Hall pass">
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
  const codeSize = Math.max(0, width - 28 * 2 - quiet * 2);

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
          <Text style={[text.body, { color: colors.ink }]}>{`Shows at ${formatWhen(before)}.`}</Text>
        ) : null}
        {code ? (
          <View style={styles.codeBlock}>
            <PassCode value={code} size={codeSize} />
            <Text style={[text.body, { color: colors.ink }]}>
              {pass?.qrVisibleUntil
                ? `Until ${formatWhen(pass.qrVisibleUntil)}.`
                : "Until you are back."}
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
  codeBlock: { gap: 16, alignItems: "center" },
  code: {
    backgroundColor: "#FFFFFF",
  },
});
