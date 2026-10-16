/**
 * Android push stays off until the hall has a Firebase project.
 * The phone must keep working with no google-services file, and it does not ask.
 */
export const ANDROID_PUSH_ENABLED = false;

/** The Settings row is only for someone who was asked and said no. Gate is never asked. */
export function notificationRowVisible(input: {
  platform: string;
  role: string;
  status: string;
}): boolean {
  if (input.platform === "web") {
    return false;
  }
  if (input.platform === "android" && !ANDROID_PUSH_ENABLED) {
    return false;
  }
  if (input.role === "gate") {
    return false;
  }
  return input.status === "denied";
}
