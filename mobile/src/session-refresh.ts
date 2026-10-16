import { ignore } from "@/safe";

/** What one refresh response does to the session that sent it. */

export type RefreshEffect = "apply" | "keep" | "end";

/**
 * 401 ends that session. A network failure, 5xx, 429, 400, or 422 keeps her
 * signed in. A newer session (a different refresh token) is never wiped or overwritten.
 */
export function refreshEffect(
  status: number | "network",
  sentRefreshToken: string,
  liveRefreshToken: string | null,
): RefreshEffect {
  if (liveRefreshToken !== sentRefreshToken) {
    return "keep";
  }
  if (status === 401) {
    return "end";
  }
  if (status === 200) {
    return "apply";
  }
  return "keep";
}

/** Parallel callers share one in-flight promise. */
export function singleFlight<T>(slot: { current: Promise<T> | null }, run: () => Promise<T>): Promise<T> {
  if (slot.current) {
    return slot.current;
  }
  const promise = run().finally(() => {
    if (slot.current === promise) {
      slot.current = null;
    }
  });
  slot.current = promise;
  return promise;
}

/** Run every step. A throw in one step does not skip the rest. */
export async function runEach(steps: Array<() => unknown>): Promise<void> {
  for (const step of steps) {
    try {
      await step();
    } catch {
      // The next step still runs.
      ignore();
    }
  }
}

export type RegisterOutcome = "saved" | "refused" | "failed";

/**
 * 204 saves the token. 422 is a final refusal. Any other failure is tried
 * once more, then left for the next time the app comes to the foreground.
 */
export function registrationNext(status: number | "error", attempts: number): "save" | "stop" | "retry" {
  if (status === 204) {
    return "save";
  }
  if (status === 422) {
    return "stop";
  }
  if (attempts >= 1) {
    return "stop";
  }
  return "retry";
}

export async function registerPushToken(
  token: string,
  post: (token: string) => Promise<number | "error">,
  attempts = 0,
): Promise<RegisterOutcome> {
  let status: number | "error";
  try {
    status = await post(token);
  } catch {
    status = "error";
  }
  const next = registrationNext(status, attempts);
  if (next === "save") {
    return "saved";
  }
  if (next === "retry") {
    return registerPushToken(token, post, attempts + 1);
  }
  return status === 422 ? "refused" : "failed";
}
