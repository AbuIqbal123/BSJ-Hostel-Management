/**
 * HTTP transport to the hall API. Session and screens share this seam.
 */

import Constants from "expo-constants";
import { Platform } from "react-native";

import { trimStop } from "@/staff-gate";

const LOCAL_HALL = "http://127.0.0.1:8000";
const FLY_HALL_DEV = "https://bsj-hostel-api-dev.fly.dev";

function explicitHall(): string | null {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  // Release builds talk to the hosted dev hall on Fly. Expo Go still finds the laptop.
  if (!__DEV__) {
    return FLY_HALL_DEV;
  }
  return null;
}

// Localhost is the phone itself, or the Android emulator. Only then use the
// computer Expo Go already reached, or the emulator's host alias.
function devMachineHall(): string | null {
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  if (host && host !== "localhost" && host !== "127.0.0.1") {
    return `http://${host}:8000`;
  }
  if (Platform.OS === "android") {
    return "http://10.0.2.2:8000";
  }
  return null;
}

let resolvedHall: string | null = null;

export async function hallFetch(path: string, init: RequestInit): Promise<Response> {
  const explicit = explicitHall();
  if (explicit) {
    return fetch(`${explicit}${path}`, init);
  }
  if (resolvedHall) {
    return fetch(`${resolvedHall}${path}`, init);
  }
  try {
    const response = await fetch(`${LOCAL_HALL}${path}`, init);
    resolvedHall = LOCAL_HALL;
    return response;
  } catch {
    const fallback = devMachineHall();
    if (!fallback) {
      throw new Error("The hall could not be reached.");
    }
    const response = await fetch(`${fallback}${path}`, init);
    resolvedHall = fallback;
    return response;
  }
}

export type HallFailure = {
  code: string | null;
  message: string;
};

export async function errorMessage(response: Response): Promise<string> {
  return (await hallFailure(response)).message;
}

export async function hallFailure(response: Response): Promise<HallFailure> {
  try {
    const body = (await response.json()) as { error?: { code?: unknown; message?: unknown } };
    const message =
      typeof body.error?.message === "string" && body.error.message.length > 0
        ? body.error.message
        : "The hall could not be reached";
    const code = typeof body.error?.code === "string" ? body.error.code : null;
    return { code, message: trimStop(message) };
  } catch {
    return { code: null, message: "The hall could not be reached" };
  }
}
