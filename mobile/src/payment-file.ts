/** Receipt rules for a guest payment. The phone converts images before upload. */

import { type Json, record, str } from "@/json";

export const MAX_EVIDENCE_BYTES = 2 * 1024 * 1024;

export const PDF_TOO_LARGE =
  "That file is too large. Take a photo of the receipt instead or choose a smaller PDF.";
export const UNSUPPORTED_FILE = "Choose a photo or a PDF";
export const PHOTO_TOO_LARGE = "That photo is still too large. Choose a smaller one";
export const EMPTY_FILE = "That file is empty";
export const PHOTO_UNREADABLE = "That photo could not be read";
export const PAYMENT_LOCKED = "Payment cannot change after arrival";
export const CLOSED_STAY = "Payment cannot change on a closed stay";
export const NOTE_REQUIRED = "A note is required to mark this paid";

export type EvidenceKind = "jpeg" | "png" | "pdf" | "convert" | "unsupported";

export type PaymentCard = {
  id: string;
  guestName: string;
  hostName: string;
  hostRoom: string;
  start: string;
  end: string;
  paymentStatus: "paid" | "unpaid";
  bucket: string;
};

export type PaymentStay = PaymentCard & {
  status: string;
  note: string;
  arrivedAt: string | null;
  evidenceName: string | null;
  evidenceType: string | null;
};

export function evidenceKind(contentType: string | null, filename: string): EvidenceKind {
  const type = (contentType ?? "").toLowerCase().split(";")[0]?.trim() ?? "";
  const name = filename.toLowerCase();
  if (type === "application/pdf" || name.endsWith(".pdf")) {
    return "pdf";
  }
  if (type === "image/png" || (type === "" && name.endsWith(".png"))) {
    return "png";
  }
  if (
    type === "image/jpeg" ||
    type === "image/jpg" ||
    (type === "" && (name.endsWith(".jpg") || name.endsWith(".jpeg")))
  ) {
    return "jpeg";
  }
  if (
    type === "image/heic" ||
    type === "image/heif" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif") ||
    type.startsWith("image/")
  ) {
    return "convert";
  }
  return "unsupported";
}

export function paymentLabel(status: "paid" | "unpaid"): "Paid" | "Not paid" {
  return status === "paid" ? "Paid" : "Not paid";
}

export function lockCopy(stay: { status: string; arrivedAt: string | null }): string | null {
  if (stay.arrivedAt !== null) {
    return PAYMENT_LOCKED;
  }
  if (stay.status !== "pending" && stay.status !== "approved") {
    return CLOSED_STAY;
  }
  return null;
}

export function pdfDecision(bytes: number): string | null {
  if (bytes <= 0) {
    return EMPTY_FILE;
  }
  if (bytes > MAX_EVIDENCE_BYTES) {
    return PDF_TOO_LARGE;
  }
  return null;
}

export function displayName(filename: string, fallback: string): string {
  const base = filename.split(/[/\\]/).pop()?.replaceAll("\0", "").trim() ?? "";
  const cut = base.slice(0, 255);
  return cut.length > 0 ? cut : fallback;
}

/** The name sent with the file. JPEG is always receipt.jpg, never a HEIC name. */
export function uploadName(kind: "jpeg" | "pdf", original: string): string {
  if (kind === "jpeg") {
    return "receipt.jpg";
  }
  const name = displayName(original, "receipt.pdf");
  return name.toLowerCase().endsWith(".pdf") ? name : "receipt.pdf";
}

export function contentType(kind: "jpeg" | "pdf"): "image/jpeg" | "application/pdf" {
  return kind === "jpeg" ? "image/jpeg" : "application/pdf";
}

function card(item: Json): PaymentCard | null {
  const payment = item.payment_status;
  if (payment !== "paid" && payment !== "unpaid") {
    return null;
  }
  const id = str(item.id);
  const guestName = str(item.guest_name);
  const hostName = str(item.host_name);
  const hostRoom = str(item.host_room_label);
  const start = str(item.guest_start_date);
  const end = str(item.guest_end_date);
  const bucket = str(item.bucket);
  if (!id || !guestName || !hostName || !hostRoom || !start || !end || !bucket) {
    return null;
  }
  return { id, guestName, hostName, hostRoom, start, end, paymentStatus: payment, bucket };
}

export function readPaymentPage(value: unknown): { items: PaymentCard[]; total: number } | null {
  const body = record(value);
  if (!body || !Array.isArray(body.items)) {
    return null;
  }
  const items: PaymentCard[] = [];
  for (const item of body.items) {
    const row = record(item);
    const parsed = row ? card(row) : null;
    if (!parsed) {
      return null;
    }
    items.push(parsed);
  }
  const total = typeof body.total === "number" ? body.total : items.length;
  return { items, total };
}

export function readPaymentStay(value: unknown): PaymentStay | null {
  const body = record(value);
  const base = body ? card(body) : null;
  const status = body ? str(body.status) : null;
  if (!body || !base || !status) {
    return null;
  }
  const note = body.payment_note;
  const arrived = body.arrived_at;
  const evidenceName = body.payment_evidence_original_name;
  const evidenceType = body.payment_evidence_content_type;
  if (
    (note !== null && typeof note !== "string") ||
    (arrived !== null && typeof arrived !== "string" && arrived !== undefined) ||
    (evidenceName !== null && typeof evidenceName !== "string" && evidenceName !== undefined) ||
    (evidenceType !== null && typeof evidenceType !== "string" && evidenceType !== undefined)
  ) {
    return null;
  }
  return {
    ...base,
    status,
    note: typeof note === "string" ? note : "",
    arrivedAt: typeof arrived === "string" ? arrived : null,
    evidenceName: typeof evidenceName === "string" ? evidenceName : null,
    evidenceType: typeof evidenceType === "string" ? evidenceType : null,
  };
}
