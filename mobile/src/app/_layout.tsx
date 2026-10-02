import { useEffect } from "react";
import { useFonts } from "expo-font";
import { Stack } from "expo-router/stack";
import * as SplashScreen from "expo-splash-screen";
import { SourceSans3_400Regular, SourceSans3_600SemiBold } from "@expo-google-fonts/source-sans-3";
import { SourceSerif4_600SemiBold } from "@expo-google-fonts/source-serif-4";
import { IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono";

import { SessionProvider } from "@/session";
import { useHallColors } from "@/theme/colors";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colors = useHallColors();
  const [fontsLoaded, fontError] = useFonts({
    SourceSans3_400Regular,
    SourceSans3_600SemiBold,
    SourceSerif4_600SemiBold,
    IBMPlexMono_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SessionProvider>
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
        <Stack.Screen name="sign-in" options={{ title: "Sign in" }} />
        <Stack.Screen name="signed-in" options={{ title: "Signed in", headerBackVisible: false }} />
      </Stack>
    </SessionProvider>
  );
}
