import { useCallback, useEffect, useRef, useState } from "react";
import * as Haptics from "expo-haptics";

import { ignore } from "@/safe";

/** How long the HallButton check stays before idle or the next step. */
export const BUTTON_TICK_HOLD_MS = 640;

export type ButtonPhase = "idle" | "busy" | "done";

/**
 * Busy → brief check → idle for a HallButton that stays on the screen.
 * Pass `after` to `markSuccess` when the next step should wait for the check
 * (navigate away, clear a form, close a sheet).
 */
export function useButtonFeedback() {
  const [phase, setPhase] = useState<ButtonPhase>("idle");
  const alive = useRef(true);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (hold.current) {
        clearTimeout(hold.current);
      }
    };
  }, []);

  const clearHold = useCallback(() => {
    if (hold.current) {
      clearTimeout(hold.current);
      hold.current = null;
    }
  }, []);

  const markBusy = useCallback(() => {
    clearHold();
    setPhase("busy");
  }, [clearHold]);

  const markIdle = useCallback(() => {
    clearHold();
    setPhase("idle");
  }, [clearHold]);

  const markSuccess = useCallback(
    (after?: () => void) => {
      clearHold();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(ignore);
      setPhase("done");
      hold.current = setTimeout(() => {
        hold.current = null;
        if (!alive.current) {
          return;
        }
        setPhase("idle");
        after?.();
      }, BUTTON_TICK_HOLD_MS);
    },
    [clearHold],
  );

  const markFailure = useCallback(() => {
    clearHold();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(ignore);
    setPhase("idle");
  }, [clearHold]);

  return {
    phase,
    busy: phase === "busy",
    succeeded: phase === "done",
    held: phase !== "idle",
    markBusy,
    markIdle,
    markSuccess,
    markFailure,
  };
}

type KeyedPhase<K extends string> =
  | { kind: "idle" }
  | { kind: "busy"; key: K }
  | { kind: "done"; key: K };

/** Same cues when one screen has several HallButtons that must not overlap. */
export function useKeyedButtonFeedback<K extends string>() {
  const [phase, setPhase] = useState<KeyedPhase<K>>({ kind: "idle" });
  const alive = useRef(true);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (hold.current) {
        clearTimeout(hold.current);
      }
    };
  }, []);

  const clearHold = useCallback(() => {
    if (hold.current) {
      clearTimeout(hold.current);
      hold.current = null;
    }
  }, []);

  const markBusy = useCallback(
    (key: K) => {
      clearHold();
      setPhase({ kind: "busy", key });
    },
    [clearHold],
  );

  const markIdle = useCallback(() => {
    clearHold();
    setPhase({ kind: "idle" });
  }, [clearHold]);

  const markSuccess = useCallback(
    (key: K, after?: () => void) => {
      clearHold();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(ignore);
      setPhase({ kind: "done", key });
      hold.current = setTimeout(() => {
        hold.current = null;
        if (!alive.current) {
          return;
        }
        setPhase({ kind: "idle" });
        after?.();
      }, BUTTON_TICK_HOLD_MS);
    },
    [clearHold],
  );

  const markFailure = useCallback(() => {
    clearHold();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(ignore);
    setPhase({ kind: "idle" });
  }, [clearHold]);

  return {
    held: phase.kind !== "idle",
    busy: (key: K) => phase.kind === "busy" && phase.key === key,
    succeeded: (key: K) => phase.kind === "done" && phase.key === key,
    markBusy,
    markIdle,
    markSuccess,
    markFailure,
  };
}
