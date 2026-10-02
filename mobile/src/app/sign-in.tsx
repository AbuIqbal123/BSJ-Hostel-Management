import { useCallback, useEffect, useRef, useState } from "react";
import { Redirect, router } from "expo-router";
import {
  Keyboard,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardEvent,
} from "react-native";

import { HallButton } from "@/components/hall-button";
import { HallMark } from "@/components/hall-mark";
import { TextField } from "@/components/text-field";
import { useSession } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

// Resting lift, with the keyboard closed. Raise this to move the whole block up.
const blockLift = 47;
// Clearance between the sign-in button and the top of the keyboard.
const keyboardGap = 16;

export default function SignInScreen() {
  const colors = useHallColors();
  const { user, signIn } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);
  const pendingRef = useRef(false);
  const buttonAnchor = useRef<View>(null);
  const restingButtonBottom = useRef<number | null>(null);
  const shiftRef = useRef(0);
  const [keyboardShift, setKeyboardShift] = useState(0);

  const rememberButton = useCallback(() => {
    if (restingButtonBottom.current != null) {
      return;
    }
    requestAnimationFrame(() => {
      if (restingButtonBottom.current != null || shiftRef.current !== 0) {
        return;
      }
      buttonAnchor.current?.measureInWindow((_x, y, _width, height) => {
        if (restingButtonBottom.current == null && shiftRef.current === 0 && height > 0) {
          restingButtonBottom.current = y + height;
        }
      });
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== "ios") {
      return;
    }
    const onFrame = (event: KeyboardEvent) => {
      const apply = (bottom: number) => {
        const keyboardTop = event.endCoordinates.screenY;
        const shift = Math.min(360, Math.max(0, Math.round(bottom + keyboardGap - keyboardTop)));
        if (shift === shiftRef.current) {
          return;
        }
        shiftRef.current = shift;
        const duration = event.duration > 10 ? event.duration : 10;
        LayoutAnimation.configureNext({
          duration,
          update: { duration, type: event.easing },
        });
        setKeyboardShift(shift);
      };
      const known = restingButtonBottom.current;
      if (known != null) {
        apply(known);
        return;
      }
      buttonAnchor.current?.measureInWindow((_x, y, _width, height) => {
        if (height <= 0) {
          return;
        }
        restingButtonBottom.current = y + height;
        apply(y + height);
      });
    };
    const subscription = Keyboard.addListener("keyboardWillChangeFrame", onFrame);
    return () => subscription.remove();
  }, []);

  const focusPassword = useCallback(() => {
    passwordRef.current?.focus();
  }, []);

  const submit = useCallback(async () => {
    if (pendingRef.current) {
      return;
    }
    pendingRef.current = true;
    const message = await signIn(username, password);
    pendingRef.current = false;
    if (message) {
      setError(message);
      return;
    }
    router.replace("/signed-in");
  }, [password, signIn, username]);

  if (user) {
    return <Redirect href="/signed-in" />;
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[styles.scroll, { paddingBottom: (blockLift + keyboardShift) * 2 }]}
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="never"
    >
      <View style={styles.center}>
        <View style={styles.block}>
          <View style={styles.mark}>
            <HallMark />
            <Text style={[text.hallName, { color: colors.ink }]}>Begum Sultan Jahan Hall</Text>
          </View>
          <View style={styles.fields}>
            <TextField
              label="Username"
              value={username}
              onChangeText={setUsername}
              autoComplete="username"
              textContentType="username"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={focusPassword}
            />
            <TextField
              inputRef={passwordRef}
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
            <View ref={buttonAnchor} onLayout={rememberButton}>
              <HallButton label="Sign in" onPress={submit} />
              <View
                pointerEvents="none"
                accessibilityElementsHidden={error === null}
                style={styles.errorSlot}
              >
                <Text
                  selectable={error !== null}
                  style={[
                    text.error,
                    styles.error,
                    {
                      color: colors.danger,
                      backgroundColor: colors.dangerBg,
                      opacity: error ? 1 : 0,
                    },
                  ]}
                >
                  {error ?? " "}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
  },
  center: { flexGrow: 1, justifyContent: "center" },
  block: { gap: 28 },
  mark: { alignItems: "center", gap: 12 },
  fields: { gap: 16 },
  errorSlot: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "100%",
    marginTop: 12,
  },
  error: {
    borderRadius: 12,
    borderCurve: "continuous",
    padding: 12,
  },
});
