import type { HallRole } from "@/session";

/** Screens a signed-in user is sent away from at launch. */
export function leavesWhenSignedIn(here: string): boolean {
  return here === "index" || here === "onboard" || here === "sign-in";
}

/** True once the first screen is the one the launch splash may reveal. */
export function routeSettled(
  ready: boolean,
  user: { role: HallRole } | null,
  here: string | undefined,
  onSignUp: boolean,
): boolean {
  if (!ready || !here) {
    return false;
  }
  if (user) {
    return !leavesWhenSignedIn(here);
  }
  return here === "sign-in" || onSignUp;
}
