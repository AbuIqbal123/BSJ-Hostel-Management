/**
 * Android push is on for Firebase project bsj-hall-dev (google-services.json).
 * A development or store build still needs the FCM V1 key on EAS credentials.
 */
export const ANDROID_PUSH_ENABLED = true;

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
