import { describe, expect, it } from "@jest/globals";

import { MAX_EVIDENCE_BYTES, PDF_TOO_LARGE } from "@/payment-file";
import {
  MAX_EDGE,
  QUALITY_FLOOR,
  QUALITY_START,
  TARGET_UPLOAD_BYTES,
  qualitySteps,
  uploadDecision,
} from "@/prepare-upload";

describe("prepare upload", () => {
  it("aims under 1.5 MiB and starts at quality 0.8 with a readable floor", () => {
    expect(TARGET_UPLOAD_BYTES).toBe(Math.floor(1.5 * 1024 * 1024));
    expect(TARGET_UPLOAD_BYTES).toBeLessThan(MAX_EVIDENCE_BYTES);
    const steps = qualitySteps();
    expect(steps[0]).toBe(QUALITY_START);
    expect(steps[0]).toBe(0.8);
    expect(steps[steps.length - 1]).toBe(QUALITY_FLOOR);
    expect(QUALITY_FLOOR).toBeGreaterThanOrEqual(0.4);
    expect(steps.every((quality, index) => index === 0 || quality < steps[index - 1]!)).toBe(true);
    expect(steps.every((quality) => quality >= QUALITY_FLOOR && quality <= 0.8)).toBe(true);
  });

  it("turns HEIC, HEIF, and PNG into a JPEG whose long side is at most 2000", () => {
    for (const kind of ["convert", "png", "jpeg"] as const) {
      const plan = uploadDecision(kind, 4032, 3024);
      expect(plan).toEqual({
        action: "jpeg",
        width: 2000,
        height: 1500,
        qualities: qualitySteps(),
      });
    }
    const small = uploadDecision("png", 800, 600);
    expect(small).toEqual({ action: "jpeg", width: 800, height: 600, qualities: qualitySteps() });
    expect(MAX_EDGE).toBe(2000);
    if (small.action === "jpeg") {
      expect(Math.max(small.width, small.height)).toBeLessThanOrEqual(MAX_EDGE);
    }
  });

  it("keeps a PDF as a PDF and refuses one over the server limit", () => {
    expect(uploadDecision("pdf", 0, 0)).toEqual({ action: "pdf" });
    expect(uploadDecision("unsupported", 100, 100)).toEqual({
      action: "refuse",
      message: "Choose a photo or a PDF",
    });
    expect(uploadDecision("jpeg", 0, 0)).toEqual({
      action: "refuse",
      message: "That photo could not be read",
    });
    expect(PDF_TOO_LARGE).toBe(
      "That file is too large. Take a photo of the receipt instead or choose a smaller PDF.",
    );
  });
});
