import { describe, expect, it } from "@jest/globals";

import {
  CLOSED_STAY,
  EMPTY_FILE,
  MAX_EVIDENCE_BYTES,
  NOTE_REQUIRED,
  PAYMENT_LOCKED,
  PDF_TOO_LARGE,
  contentType,
  evidenceKind,
  lockCopy,
  paymentLabel,
  pdfDecision,
  readPaymentStay,
  uploadName,
} from "@/payment-file";

describe("payment file rules", () => {
  it("treats HEIC, HEIF, and other images as photos and never names a JPEG HEIC", () => {
    expect(evidenceKind("image/heic", "IMG.HEIC")).toBe("convert");
    expect(evidenceKind("image/heif", "shot.heif")).toBe("convert");
    expect(evidenceKind("image/webp", "shot.webp")).toBe("convert");
    expect(evidenceKind(null, "photo.heic")).toBe("convert");
    expect(evidenceKind("image/png", "shot.png")).toBe("png");
    expect(uploadName("jpeg", "IMG.HEIC")).toBe("receipt.jpg");
    expect(contentType("jpeg")).toBe("image/jpeg");
    expect(uploadName("jpeg", "folder/receipt.heic")).not.toMatch(/heic/i);
    expect(uploadName("jpeg", "Screenshot 1.png")).toBe("receipt.jpg");
  });

  it("refuses a PDF over 2 MiB with the receipt sentence and accepts exactly 2 MiB", () => {
    expect(pdfDecision(MAX_EVIDENCE_BYTES + 1)).toBe(PDF_TOO_LARGE);
    expect(pdfDecision(MAX_EVIDENCE_BYTES)).toBeNull();
    expect(pdfDecision(0)).toBe(EMPTY_FILE);
    expect(uploadName("pdf", "C:\\receipts\\desk.pdf")).toBe("desk.pdf");
    expect(contentType("pdf")).toBe("application/pdf");
  });

  it("refuses Word and other documents", () => {
    expect(evidenceKind("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "note.docx")).toBe(
      "unsupported",
    );
    expect(evidenceKind("application/msword", "note.doc")).toBe("unsupported");
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
