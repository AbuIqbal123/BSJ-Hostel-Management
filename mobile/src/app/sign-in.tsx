import { useCallback, useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import {
  Keyboard,
  LayoutAnimation,
  Platform,
  Pressable,
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
// Android keyboard events often report duration 0; match a short ease.
const fallbackMotionMs = 250;

export default function SignInScreen() {
  const colors = useHallColors();
  const { user, signIn } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
  const outlineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tryLowerRef = useRef<(event?: KeyboardEvent) => void>(() => {});
  const [pad, setPad] = useState<number | null>(null);
  const [keyboardUp, setKeyboardUp] = useState(false);
  const [outlineReady, setOutlineReady] = useState(false);

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
    if (focusCount.current > 0) {
      return;
    }
    // Hide can race ahead of blur and bail while focusCount was still > 0.
    // Retry lower once focus has actually cleared.
    const ticket = hideTicket.current;
    requestAnimationFrame(() => {
      if (ticket !== hideTicket.current) {
        return;
      }
      tryLowerRef.current();
    });
  }, []);

  useEffect(() => {
    const motionMs = (event?: KeyboardEvent) => {
      const duration = event?.duration ?? 0;
      return duration > 0 ? duration : fallbackMotionMs;
    };

    const clearOutlineTimer = () => {
      if (outlineTimer.current == null) {
        return;
      }
      clearTimeout(outlineTimer.current);
      outlineTimer.current = null;
    };

    const syncMotion = (event?: KeyboardEvent) => {
      const duration = event?.duration ?? 0;
      if (duration > 0 && event) {
        Keyboard.scheduleLayoutAnimation(event);
        return;
      }
      LayoutAnimation.configureNext({
        duration: fallbackMotionMs,
        update: {
          duration: fallbackMotionMs,
          type: LayoutAnimation.Types.easeInEaseOut,
        },
      });
    };

    const place = (next: number, event?: KeyboardEvent) => {
      if (next === padRef.current) {
        return;
      }
      padRef.current = next;
      syncMotion(event);
      setPad(next);
    };

    const armOutline = (event?: KeyboardEvent) => {
      clearOutlineTimer();
      setOutlineReady(false);
      outlineTimer.current = setTimeout(() => {
        outlineTimer.current = null;
        setOutlineReady(true);
      }, motionMs(event));
    };

    const tryLower = (event?: KeyboardEvent) => {
      if (!keyboardUpRef.current) {
        return;
      }
      if (focusCount.current > 0) {
        return;
      }
      // Hide events own the synced lower. A blur-only call must wait until the
      // keyboard is gone so it does not steal WillHide's scheduleLayoutAnimation
      // with a fallback LayoutAnimation.
      if (event == null && Keyboard.isVisible()) {
        return;
      }
      clearOutlineTimer();
      setOutlineReady(false);
      keyboardUpRef.current = false;
      setKeyboardUp(false);
      if (restingPad.current <= 0) {
        padRef.current = null;
        syncMotion(event);
        setPad(null);
        return;
      }
      place(restingPad.current, event);
    };
    tryLowerRef.current = tryLower;

    const raiseFrom = (event: KeyboardEvent, bottom: number) => {
      const next = Math.max(
        restingPad.current,
        Math.round(bottom - event.endCoordinates.screenY + keyboardGap),
      );
      const first = !keyboardUpRef.current;
      if (first) {
        keyboardUpRef.current = true;
        setKeyboardUp(true);
        armOutline(event);
      } else if (next <= (padRef.current ?? 0)) {
        // Keep the highest pad while raised (field switches). Lowering is owned
        // by tryLower + scheduleLayoutAnimation on hide.
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
      const attempt = () => {
        if (ticket !== hideTicket.current) {
          return;
        }
        tryLower(event);
      };
      // Lower immediately with the hide event so scheduleLayoutAnimation matches
      // the keyboard. Retry once if blur is still in flight.
      if (focusCount.current > 0) {
        requestAnimationFrame(() => {
          if (ticket !== hideTicket.current) {
            return;
          }
          if (focusCount.current > 0) {
            setTimeout(attempt, 64);
            return;
          }
          attempt();
        });
        return;
      }
      attempt();
    };

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const subscriptions = [
      Keyboard.addListener(showEvent, onShow),
      Keyboard.addListener(hideEvent, onHide),
    ];
    if (Platform.OS === "ios") {
      subscriptions.push(Keyboard.addListener("keyboardWillChangeFrame", onFrame));
    }

    return () => {
      clearOutlineTimer();
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, []);

  const focusPassword = useCallback(() => {
    passwordRef.current?.focus();
  }, []);

  // Tap-away (not swipe): blur first so focusCount clears, then dismiss, then
  // race tryLower in case hide/blur ordering would leave the block raised.
  const onTapAway = useCallback(() => {
    const focused = TextInput.State.currentlyFocusedInput();
    if (focused != null) {
      TextInput.State.blurTextInput(focused);
    }
    Keyboard.dismiss();
    const ticket = hideTicket.current;
    const attempt = () => {
      if (ticket !== hideTicket.current) {
        return;
      }
      tryLowerRef.current();
    };
    requestAnimationFrame(() => {
      if (ticket !== hideTicket.current) {
        return;
      }
      if (focusCount.current > 0 || Keyboard.isVisible()) {
        setTimeout(attempt, 64);
        return;
      }
      tryLowerRef.current();
    });
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
    setBusy(true);
    const message = await signIn(username, password);
    pendingRef.current = false;
    setBusy(false);
    if (message) {
      setError(message);
    }
  }, [password, signIn, username]);

  if (user) {
    return <View style={[styles.screen, { backgroundColor: colors.paper }]} />;
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
        <Pressable
          accessible={false}
          style={StyleSheet.absoluteFill}
          onPress={onTapAway}
        />
        <View
          pointerEvents="box-none"
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
              showOutline={outlineReady}
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
              showOutline={outlineReady}
            />
            <View style={styles.submit}>
              <HallButton label={busy ? "Signing in" : "Sign in"} disabled={busy} onPress={submit} />
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Don't have an account? Sign up"
                onPress={() => router.push("/onboard")}
                style={styles.onboard}
              >
                <Text style={[text.body, { color: colors.ink }]}>
                  Don't have an account?{" "}
                  <Text style={{ color: colors.forest }}>Sign up</Text>
                </Text>
              </Pressable>
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
  submit: { gap: 16 },
  onboard: {
    alignItems: "center",
  },
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
