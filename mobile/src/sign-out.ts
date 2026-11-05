/**
 * Sign-out confirmation and the brief cue on the sign-in screen.
 */

import { Alert } from "react-native";

import { paramText } from "@/route-param";

export const SIGNED_OUT_NOTICE = "You're signed out";

/** Query value the sign-in screen reads after a deliberate sign-out. */
export const SIGNED_OUT_PARAM = "signed-out";

export function signedOutNotice(param: string | string[] | undefined): string | null {
  return paramText(param) === SIGNED_OUT_PARAM ? SIGNED_OUT_NOTICE : null;
}

/** Confirm, then run sign-out. Cancel leaves her signed in. */
export function confirmSignOut(signOut: () => Promise<void>, after: () => void): void {
  Alert.alert("Sign out?", undefined, [
    { text: "Cancel", style: "cancel" },
    {
      text: "Sign out",
      style: "destructive",
      onPress: () => {
        void signOut().then(after);
      },
    },
  ]);
}
