import { File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import {
  PHOTO_TOO_LARGE,
  PHOTO_UNREADABLE,
  UNSUPPORTED_FILE,
  contentType,
  evidenceKind,
  pdfDecision,
  uploadName,
  type EvidenceKind,
} from "@/payment-file";

export const MAX_EDGE = 2000;
export const QUALITY_START = 0.8;
export const QUALITY_FLOOR = 0.4;
export const QUALITY_STEP = 0.1;
/** Headroom under the 2 MiB server limit. */
export const TARGET_UPLOAD_BYTES = Math.floor(1.5 * 1024 * 1024);

export type PreparedReceipt = {
  uri: string;
  name: string;
  type: "image/jpeg" | "application/pdf";
  bytes: number;
  preview: boolean;
};

export type SourceFile = {
  uri: string;
  name: string;
  mime: string | null;
  width: number | null;
  height: number | null;
};

export type UploadDecision =
  | { action: "pdf" }
  | { action: "jpeg"; width: number; height: number; qualities: number[] }
  | { action: "refuse"; message: string };

/** 0.8, then one step lower each time, stopping at the readable floor. */
export function qualitySteps(): number[] {
  const steps: number[] = [];
  const start = Math.round(QUALITY_START * 10);
  const floor = Math.round(QUALITY_FLOOR * 10);
  const step = Math.round(QUALITY_STEP * 10);
  for (let tenths = start; tenths >= floor; tenths -= step) {
    steps.push(tenths / 10);
  }
  return steps;
}

/** Longest side at most `longest`, without enlarging the photo. */
export function fittedEdge(width: number, height: number, longest: number): { width: number; height: number } {
  const current = Math.max(width, height);
  if (current <= longest || current <= 0) {
    return { width, height };
  }
  const scale = longest / current;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** HEIC, HEIF, PNG, and JPEG become one JPEG plan. A PDF stays a PDF. */
export function uploadDecision(kind: EvidenceKind, width: number, height: number): UploadDecision {
  if (kind === "pdf") {
    return { action: "pdf" };
  }
  if (kind === "unsupported") {
    return { action: "refuse", message: UNSUPPORTED_FILE };
  }
  if (width <= 0 || height <= 0) {
    return { action: "refuse", message: PHOTO_UNREADABLE };
  }
  const fitted = fittedEdge(width, height, MAX_EDGE);
  return { action: "jpeg", width: fitted.width, height: fitted.height, qualities: qualitySteps() };
}

function namedCopy(uri: string, name: string): File {
  const dest = new File(Paths.cache, name);
  if (dest.exists) {
    dest.delete();
  }
  new File(uri).copySync(dest);
  return dest;
}

/** Turn a picked photo or PDF into a file the hall will store. Images are re-encoded, so location data is not sent. */
export async function prepareUpload(
  source: SourceFile,
): Promise<{ ok: true; file: PreparedReceipt } | { ok: false; message: string }> {
  const kind = evidenceKind(source.mime, source.name);
  if (kind === "pdf") {
    const bytes = new File(source.uri).size;
    const refused = pdfDecision(bytes);
    if (refused) {
      return { ok: false, message: refused };
    }
    const name = uploadName("pdf", source.name);
    const file = namedCopy(source.uri, name);
    return { ok: true, file: { uri: file.uri, name, type: contentType("pdf"), bytes: file.size, preview: false } };
  }

  const plan = uploadDecision(kind, source.width ?? 0, source.height ?? 0);
  if (plan.action === "refuse") {
    return { ok: false, message: plan.message };
  }
  if (plan.action !== "jpeg") {
    return { ok: false, message: UNSUPPORTED_FILE };
  }

  for (const quality of plan.qualities) {
    const context = ImageManipulator.manipulate(source.uri);
    if (plan.width !== source.width || plan.height !== source.height) {
      context.resize({ width: plan.width });
    }
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ compress: quality, format: SaveFormat.JPEG });
    const savedFile = new File(saved.uri);
    if (savedFile.size > 0 && savedFile.size <= TARGET_UPLOAD_BYTES) {
      const name = uploadName("jpeg", source.name);
      const file = namedCopy(saved.uri, name);
      return { ok: true, file: { uri: file.uri, name, type: contentType("jpeg"), bytes: file.size, preview: true } };
    }
  }
  return { ok: false, message: PHOTO_TOO_LARGE };
}
