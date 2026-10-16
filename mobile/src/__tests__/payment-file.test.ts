import { describe, expect, it } from "@jest/globals";

import {
  CLOSED_STAY,
  EMPTY_FILE,
  MAX_EDGE,
  MAX_EVIDENCE_BYTES,
  NOTE_REQUIRED,
  PAYMENT_LOCKED,
  PDF_TOO_LARGE,
  PHOTO_TOO_LARGE,
  PHOTO_UNREADABLE,
  UNSUPPORTED_FILE,
  contentType,
  evidenceKind,
  fittedEdge,
  imagePlan,
  jpegPasses,
  lockCopy,
  paymentLabel,
  pdfDecision,
  readPaymentStay,
  uploadName,
} from "@/payment-file";

describe("payment file rules", () => {
  it("treats HEIC, HEIF, and other images as JPEG conversions and never names them HEIC", () => {
    expect(evidenceKind("image/heic", "IMG.HEIC")).toBe("convert");
    expect(evidenceKind("image/heif", "shot.heif")).toBe("convert");
    expect(evidenceKind("image/webp", "shot.webp")).toBe("convert");
    expect(evidenceKind(null, "photo.heic")).toBe("convert");
    const plan = imagePlan("convert", 4_000_000, 4032, 3024);
    expect(plan.action).toBe("jpeg");
    if (plan.action === "jpeg") {
      expect(plan.steps[0]).toEqual({ quality: 0.7, longest: MAX_EDGE });
      expect(plan.steps.every((step) => step.quality <= 0.7 && step.longest <= MAX_EDGE)).toBe(true);
    }
    expect(uploadName("jpeg", "IMG.HEIC")).toBe("receipt.jpg");
    expect(contentType("jpeg")).toBe("image/jpeg");
    expect(uploadName("jpeg", "folder/receipt.heic")).not.toMatch(/heic/i);
  });

  it("keeps a PNG screenshot that is already under 2 MiB and converts a larger one", () => {
    expect(imagePlan("png", 80_000, 1170, 2532)).toEqual({ action: "keep-png" });
    expect(uploadName("png", "Screenshot 1.png")).toBe("Screenshot 1.png");
    expect(contentType("png")).toBe("image/png");
    const large = imagePlan("png", MAX_EVIDENCE_BYTES + 1, 4000, 3000);
    expect(large.action).toBe("jpeg");
  });

  it("caps the long side at 2000 and does not enlarge a smaller photo", () => {
    expect(fittedEdge(4000, 3000, 2000)).toEqual({ width: 2000, height: 1500 });
    expect(fittedEdge(800, 600, 2000)).toEqual({ width: 800, height: 600 });
    expect(jpegPasses(800, 600)[0]).toEqual({ quality: 0.7, longest: 800 });
    expect(imagePlan("jpeg", 1000, 800, 600).action).toBe("jpeg");
  });

  it("refuses a PDF over 2 MiB with the receipt sentence and accepts exactly 2 MiB", () => {
    expect(pdfDecision(MAX_EVIDENCE_BYTES + 1)).toBe(PDF_TOO_LARGE);
    expect(pdfDecision(MAX_EVIDENCE_BYTES)).toBeNull();
    expect(pdfDecision(0)).toBe(EMPTY_FILE);
    expect(uploadName("pdf", "C:\\receipts\\desk.pdf")).toBe("desk.pdf");
    expect(contentType("pdf")).toBe("application/pdf");
  });

  it("refuses Word and other documents, and a photo with no size", () => {
    expect(evidenceKind("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "note.docx")).toBe(
      "unsupported",
    );
    expect(evidenceKind("application/msword", "note.doc")).toBe("unsupported");
    expect(imagePlan("unsupported", 10, 10, 10)).toEqual({ action: "refuse", message: UNSUPPORTED_FILE });
    expect(imagePlan("jpeg", 10, 0, 0)).toEqual({ action: "refuse", message: PHOTO_UNREADABLE });
    expect(PHOTO_TOO_LARGE.length).toBeGreaterThan(0);
    expect(NOTE_REQUIRED).toBe("A note is required to mark this paid");
  });

  it("shows paid or unpaid, and locks payment after arrival or on a closed stay", () => {
    expect(paymentLabel("paid")).toBe("Paid");
    expect(paymentLabel("unpaid")).toBe("Not paid");
    expect(lockCopy({ status: "approved", arrivedAt: null })).toBeNull();
    expect(lockCopy({ status: "pending", arrivedAt: null })).toBeNull();
    expect(lockCopy({ status: "approved", arrivedAt: "2026-10-01T10:00:00Z" })).toBe(PAYMENT_LOCKED);
    expect(lockCopy({ status: "rejected", arrivedAt: null })).toBe(CLOSED_STAY);
    expect(lockCopy({ status: "departed", arrivedAt: "2026-10-01T10:00:00Z" })).toBe(PAYMENT_LOCKED);
  });

  it("reads a stay, including evidence metadata and a missing note", () => {
    const stay = readPaymentStay({
      id: "stay-1",
      guest_name: "Fatima Begum",
      host_name: "Aisha Khan",
      host_room_label: "B-204",
      guest_start_date: "2026-10-20",
      guest_end_date: "2026-10-22",
      status: "approved",
      payment_status: "unpaid",
      bucket: "upcoming",
      payment_note: null,
      arrived_at: null,
      payment_evidence_original_name: null,
      payment_evidence_content_type: null,
    });
    expect(stay?.paymentStatus).toBe("unpaid");
    expect(stay?.note).toBe("");
    expect(stay?.evidenceName).toBeNull();
    expect(lockCopy(stay ?? { status: "approved", arrivedAt: null })).toBeNull();
  });
});
