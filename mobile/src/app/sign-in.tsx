import { useCallback, useEffect, useRef, useState } from "react";
import { Redirect, router } from "expo-router";
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardEvent,
  type LayoutChangeEvent,
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
  const canvasRef = useRef<View>(null);
  const canvasHeightRef = useRef(0);
  const blockHeightRef = useRef(0);
  const canvasBottom = useRef(0);
  const restingPad = useRef(0);
  const padRef = useRef<number | null>(null);
  const keyboardUpRef = useRef(false);
  const focusCount = useRef(0);
  const hideTicket = useRef(0);
  const [pad, setPad] = useState<number | null>(null);
  const [keyboardUp, setKeyboardUp] = useState(false);

  const syncResting = useCallback((canvasHeight: number, blockHeight: number) => {
    // Wait until the canvas has stretched past the block. An early content-sized
    // height would pin the block too low.
    if (canvasHeight <= blockHeight || keyboardUpRef.current) {
      return;
    }
    const resting = Math.max(0, Math.round((canvasHeight - blockHeight) / 2 + blockLift));
    restingPad.current = resting;
    if (padRef.current === resting) {
      return;
    }
    padRef.current = resting;
    setPad(resting);
  }, []);

  const onCanvasLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const height = Math.round(event.nativeEvent.layout.height);
      canvasHeightRef.current = height;
      canvasRef.current?.measure((_x, _y, _width, measured, _pageX, pageY) => {
        if (measured > 0) {
          canvasBottom.current = pageY + measured;
        }
      });
      syncResting(height, blockHeightRef.current);
    },
    [syncResting],
  );

  const onBlockLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const height = Math.round(event.nativeEvent.layout.height);
      if (height === blockHeightRef.current) {
        return;
      }
      blockHeightRef.current = height;
      syncResting(canvasHeightRef.current, height);
    },
    [syncResting],
  );

  const onFieldFocus = useCallback(() => {
    focusCount.current += 1;
  }, []);

  const onFieldBlur = useCallback(() => {
    focusCount.current = Math.max(0, focusCount.current - 1);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "ios") {
      return;
    }

    const place = (next: number, event: KeyboardEvent) => {
      if (next === padRef.current) {
        return;
      }
      padRef.current = next;
      Keyboard.scheduleLayoutAnimation(event);
      setPad(next);
    };

    const raiseFrom = (event: KeyboardEvent, bottom: number) => {
      const next = Math.max(
        restingPad.current,
        Math.round(bottom - event.endCoordinates.screenY + keyboardGap),
      );
      const first = !keyboardUpRef.current;
      if (first) {
        keyboardUpRef.current = true;
        setKeyboardUp(true);
      } else if (next <= (padRef.current ?? 0)) {
        return;
      }
      place(next, event);
    };

    const raise = (event: KeyboardEvent) => {
      const keyboardTop = event.endCoordinates.screenY;
      if (event.endCoordinates.height <= 0 || keyboardTop <= 0) {
        return;
      }
      if (canvasBottom.current > 0) {
        raiseFrom(event, canvasBottom.current);
        return;
      }
      canvasRef.current?.measure((_x, _y, _width, height, _pageX, pageY) => {
        if (height <= 0) {
          return;
        }
        canvasBottom.current = pageY + height;
        raiseFrom(event, pageY + height);
      });
    };

    const onShow = (event: KeyboardEvent) => {
      hideTicket.current += 1;
      raise(event);
    };

    const onFrame = (event: KeyboardEvent) => {
      if (!keyboardUpRef.current) {
        return;
      }
      raise(event);
    };

    const onHide = (event: KeyboardEvent) => {
      const ticket = ++hideTicket.current;
      requestAnimationFrame(() => {
        if (ticket !== hideTicket.current) {
          return;
        }
        if (focusCount.current > 0 || Keyboard.isVisible()) {
          return;
        }
        if (!keyboardUpRef.current) {
          return;
        }
        keyboardUpRef.current = false;
        setKeyboardUp(false);
        if (restingPad.current <= 0) {
          padRef.current = null;
          Keyboard.scheduleLayoutAnimation(event);
          setPad(null);
          return;
        }
        place(restingPad.current, event);
      });
    };

    const subscriptions = [
      Keyboard.addListener("keyboardWillShow", onShow),
      Keyboard.addListener("keyboardWillChangeFrame", onFrame),
      Keyboard.addListener("keyboardWillHide", onHide),
    ];
    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, []);

  const focusPassword = useCallback(() => {
    passwordRef.current?.focus();
  }, []);

  const onUsername = useCallback((value: string) => {
    setUsername(value);
    setError(null);
  }, []);

  const onPassword = useCallback((value: string) => {
    setPassword(value);
    setError(null);
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
      contentContainerStyle={styles.canvas}
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="never"
      // The form never overflows, so a drag can dismiss the keyboard only
      // while bounce is on. Keep it off once the keyboard is down.
      bounces={keyboardUp}
      overScrollMode={keyboardUp ? "always" : "never"}
      showsVerticalScrollIndicator={false}
    >
      <View
        ref={canvasRef}
        style={[styles.canvas, pad == null && styles.resting]}
        onLayout={onCanvasLayout}
      >
        <View
          style={pad == null ? styles.block : [styles.block, styles.pinned, { bottom: pad }]}
          onLayout={onBlockLayout}
        >
          <View style={styles.mark}>
            <HallMark />
            <Text style={[text.hallName, { color: colors.ink }]}>Begum Sultan Jahan Hall</Text>
          </View>
          <View style={styles.fields}>
            <TextField
              label="Username"
              value={username}
              onChangeText={onUsername}
              autoComplete="username"
              textContentType="username"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={focusPassword}
              onFocus={onFieldFocus}
              onBlur={onFieldBlur}
            />
            <TextField
              inputRef={passwordRef}
              label="Password"
              value={password}
              onChangeText={onPassword}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
              onFocus={onFieldFocus}
              onBlur={onFieldBlur}
            />
            <View>
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
  canvas: { flexGrow: 1 },
  resting: {
    justifyContent: "center",
    paddingBottom: blockLift * 2,
    paddingHorizontal: 28,
  },
  pinned: {
    position: "absolute",
    left: 28,
    right: 28,
  },
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
