import { useEffect, useRef } from "react";
import { useFonts } from "expo-font";
import { router, useSegments } from "expo-router";
import { Stack } from "expo-router/stack";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Feather } from "@expo/vector-icons";
import { SourceSans3_400Regular, SourceSans3_600SemiBold } from "@expo-google-fonts/source-sans-3";
import { SourceSerif4_600SemiBold } from "@expo-google-fonts/source-serif-4";
import { IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono";

import { SessionProvider, useSession } from "@/session";
import { useHallColors } from "@/theme/colors";

SplashScreen.preventAutoHideAsync();

// A fresh launch starts at the index gate. A restored path can still skip it.
export const unstable_settings = {
  initialRouteName: "index",
};

// The dev client restores the last route, which can be signup. Send a stored
// session home, and a logged-out open to sign-in. Sign up stays available
// once she has actually been on sign-in.
function LaunchGate() {
  const { ready, user } = useSession();
  const segments = useSegments();
  const openedFromSignIn = useRef(false);

  useEffect(() => {
    if (!ready) {
      return;
    }
    const here = segments[0];
    if (!here) {
      return;
    }
    if (user) {
      if (here === "index" || here === "onboard" || here === "sign-in") {
        router.replace(user.role === "resident" ? "/home" : "/signed-in");
        return;
      }
      SplashScreen.hideAsync();
      return;
    }
    if (here === "sign-in") {
      openedFromSignIn.current = true;
      SplashScreen.hideAsync();
      return;
    }
    if (here === "onboard" && openedFromSignIn.current) {
      SplashScreen.hideAsync();
      return;
    }
    router.replace("/sign-in");
  }, [ready, user, segments]);

  return null;
}

export default function RootLayout() {
  const colors = useHallColors();
  const [fontsLoaded, fontError] = useFonts({
    ...Feather.font,
    SourceSans3_400Regular,
    SourceSans3_600SemiBold,
    SourceSerif4_600SemiBold,
    IBMPlexMono_500Medium,
  });


  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.paper }}>
      <SessionProvider>
        <LaunchGate />
        <Stack
          screenOptions={{
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.paper },
            headerTintColor: colors.ink,
            contentStyle: { backgroundColor: colors.paper },
            headerTitleStyle: { fontFamily: "SourceSans3_600SemiBold", color: colors.ink },
            // Auth gate: fade avoids a push slide on boot / replace.
            animation: "fade",
            animationDuration: 220,
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
          <Stack.Screen name="onboard" options={{ headerShown: false }} />
          <Stack.Screen name="change-password" options={{ title: "Change password" }} />
          <Stack.Screen name="(resident)" options={{ headerShown: false }} />
          <Stack.Screen name="signed-in" options={{ title: "Signed in", headerBackVisible: false }} />
        </Stack>
      </SessionProvider>
    </GestureHandlerRootView>
  );
}
