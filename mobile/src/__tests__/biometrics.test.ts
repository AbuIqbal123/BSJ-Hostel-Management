import { describe, expect, it } from "@jest/globals";
import { AuthenticationType } from "expo-local-authentication";

import { biometricLabelFor } from "@/biometrics";

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
