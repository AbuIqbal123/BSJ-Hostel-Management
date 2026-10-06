import { useEffect, useRef, useState } from "react";
import { useFonts } from "expo-font";
import { router, useSegments } from "expo-router";
import { Stack } from "expo-router/stack";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Feather } from "@expo/vector-icons";
import { SourceSans3_400Regular, SourceSans3_600SemiBold } from "@expo-google-fonts/source-sans-3";
import { SourceSerif4_600SemiBold } from "@expo-google-fonts/source-serif-4";
import { IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono";

import { HallMark } from "@/components/hall-mark";
import { SessionProvider, useSession } from "@/session";
import { AppearanceProvider, useDark } from "@/theme/appearance";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

SplashScreen.preventAutoHideAsync();

const LAUNCH_MS = 750;
const FADE_MS = 280;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

// A fresh launch starts at the index gate. A restored path can still skip it.
export const unstable_settings = {
  initialRouteName: "index",
};

function routeSettled(
  ready: boolean,
  user: { role: string } | null,
  here: string | undefined,
  onSignUp: boolean,
): boolean {
  if (!ready || !here) {
    return false;
  }
  if (user) {
    return user.role === "resident" ? here === "(resident)" : here === "signed-in";
  }
  return here === "sign-in" || onSignUp;
}

// The restored route can be signup. It stays underneath until this lifts.
function LaunchShell({ fontsReady }: { fontsReady: boolean }) {
  const colors = useHallColors();
  const dark = useDark();
  const reduced = useReducedMotion();
  const { ready, user } = useSession();
  const segments = useSegments();
  const openedFromSignIn = useRef(false);
  const started = useRef(Date.now());
  const nativeHidden = useRef(false);
  const dismissing = useRef(false);
  const reducedNow = useRef(reduced);
  reducedNow.current = reduced;
  const cover = useSharedValue(1);
  const [splash, setSplash] = useState(true);
  const here = segments[0];
  const onSignUp = here === "onboard" && openedFromSignIn.current;
  const settled = routeSettled(ready, user, here, onSignUp);

  useEffect(() => {
    if (!ready || !here) {
      return;
    }
    if (user) {
      if (here === "index" || here === "onboard" || here === "sign-in") {
        router.replace(user.role === "resident" ? "/home" : "/signed-in");
      }
      return;
    }
    if (here === "sign-in") {
      openedFromSignIn.current = true;
      return;
    }
    if (here === "onboard" && openedFromSignIn.current) {
      return;
    }
    router.replace("/sign-in");
  }, [ready, user, here]);

  useEffect(() => {
    if (!settled || !fontsReady || dismissing.current) {
      return;
    }
    dismissing.current = true;
    const wait = Math.max(0, LAUNCH_MS - (Date.now() - started.current));
    setTimeout(() => {
      if (reducedNow.current) {
        setSplash(false);
        return;
      }
      cover.set(
        withTiming(0, { duration: FADE_MS, easing: EASE_OUT }, (finished) => {
          if (finished) {
            scheduleOnRN(setSplash, false);
          }
        }),
      );
    }, wait);
  }, [cover, fontsReady, settled]);

  const fade = useAnimatedStyle(() => ({ opacity: cover.get() }));

  const hideNative = () => {
    if (nativeHidden.current) {
      return;
    }
    nativeHidden.current = true;
    SplashScreen.hideAsync();
  };

  return (
    <View style={styles.shell}>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.paper },
          headerTintColor: colors.ink,
          contentStyle: { backgroundColor: colors.paper },
          headerTitleStyle: { fontFamily: "SourceSans3_600SemiBold", color: colors.ink },
          animation: "fade",
          animationDuration: 220,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false, animation: "none" }} />
        <Stack.Screen name="sign-in" options={{ headerShown: false, animation: "none" }} />
        <Stack.Screen name="onboard" options={{ headerShown: false, animation: "none" }} />
        <Stack.Screen
          name="change-password"
          options={{
            headerShown: false,
            animation: reduced ? "fade" : "default",
          }}
        />
        <Stack.Screen name="(resident)" options={{ headerShown: false, animation: "none" }} />
        <Stack.Screen name="signed-in" options={{ title: "Signed in", headerBackVisible: false }} />
      </Stack>
      {splash ? (
        <Animated.View
          style={[styles.hold, { backgroundColor: colors.paper }, fade]}
          accessibilityRole="summary"
          accessibilityLabel="Begum Sultan Jahan Hall, loading"
          accessibilityViewIsModal
          onLayout={hideNative}
        >
          <View style={styles.mark}>
            <HallMark width={112} />
            {fontsReady ? (
              <Text style={[text.hallName, styles.word, { color: colors.ink }]}>
                Begum Sultan Jahan Hall
              </Text>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

function AppShell({ fontsReady }: { fontsReady: boolean }) {
  const colors = useHallColors();
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.paper }}>
      <SessionProvider>
        <LaunchShell fontsReady={fontsReady} />
      </SessionProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    ...Feather.font,
    SourceSans3_400Regular,
    SourceSans3_600SemiBold,
    SourceSerif4_600SemiBold,
    IBMPlexMono_500Medium,
  });

  return (
    <AppearanceProvider>
      <AppShell fontsReady={fontsLoaded || Boolean(fontError)} />
    </AppearanceProvider>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  hold: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  mark: {
    alignItems: "center",
    gap: 22,
    paddingHorizontal: 28,
  },
  word: { textAlign: "center" },
});
