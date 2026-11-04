import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { AuthenticationType } from "expo-local-authentication";

const mockStore = new Map<string, string>();

jest.mock("@/phone-store", () => ({
  phoneGet: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  phoneSet: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
  phoneDelete: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
}));

jest.mock("expo-local-authentication", () => {
  const actual = jest.requireActual("expo-local-authentication") as typeof import("expo-local-authentication");
  return {
    ...actual,
    hasHardwareAsync: jest.fn(async () => true),
    isEnrolledAsync: jest.fn(async () => true),
    supportedAuthenticationTypesAsync: jest.fn(async () => [actual.AuthenticationType.FINGERPRINT]),
    authenticateAsync: jest.fn(async () => ({ success: true })),
  };
});

import {
  biometricLabelFor,
  biometricSignInEnabled,
  biometricSignInReady,
  clearBiometricSignIn,
  readBiometricCredentials,
  saveBiometricCredentials,
  setBiometricSignInEnabled,
} from "@/biometrics";

describe("biometricLabelFor", () => {
  it("names Face ID on iOS facial recognition", () => {
    expect(biometricLabelFor([AuthenticationType.FACIAL_RECOGNITION])).toMatch(/Face/);
  });

  it("names fingerprint when that is what the device offers", () => {
    expect(biometricLabelFor([AuthenticationType.FINGERPRINT])).toMatch(/Touch ID|Fingerprint/);
  });

  it("falls back when no known type is listed", () => {
    expect(biometricLabelFor([])).toBe("Biometrics");
  });
});

describe("biometric sign-in lifecycle", () => {
  beforeEach(() => {
    mockStore.clear();
  });

  it("saves and reads credentials after preference is on", async () => {
    await setBiometricSignInEnabled(true);
    await saveBiometricCredentials({ username: "aisha", password: "secret1" });
    expect(await biometricSignInEnabled()).toBe(true);
    expect(await readBiometricCredentials()).toEqual({ username: "aisha", password: "secret1" });
    expect(await biometricSignInReady()).toBe(true);
  });

  it("clears preference and credentials together", async () => {
    await setBiometricSignInEnabled(true);
    await saveBiometricCredentials({ username: "aisha", password: "secret1" });
    await clearBiometricSignIn();
    expect(await biometricSignInEnabled()).toBe(false);
    expect(await readBiometricCredentials()).toBeNull();
    expect(await biometricSignInReady()).toBe(false);
  });

  it("migrates the legacy preference key", async () => {
    mockStore.set("bsj.biometric.unlock", "1");
    expect(await biometricSignInEnabled()).toBe(true);
    expect(mockStore.get("bsj.biometric.sign-in")).toBe("1");
    expect(mockStore.has("bsj.biometric.unlock")).toBe(false);
  });
});
