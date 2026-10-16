import { File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import {
  MAX_EVIDENCE_BYTES,
  PHOTO_TOO_LARGE,
  UNSUPPORTED_FILE,
  contentType,
  evidenceKind,
  fittedEdge,
  imagePlan,
  pdfDecision,
  uploadName,
} from "@/payment-file";

export type PreparedReceipt = {
  uri: string;
  name: string;
  type: "image/jpeg" | "image/png" | "application/pdf";
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

function namedCopy(uri: string, name: string): File {
  const dest = new File(Paths.cache, name);
  if (dest.exists) {
    dest.delete();
  }
  new File(uri).copySync(dest);
  return dest;
}

/** Turn a picked photo or PDF into a file the hall will store. Images are re-encoded, so location data is not sent. */
export async function prepareReceipt(
  source: SourceFile,
): Promise<{ ok: true; file: PreparedReceipt } | { ok: false; message: string }> {
  const kind = evidenceKind(source.mime, source.name);
  if (kind === "unsupported") {
    return { ok: false, message: UNSUPPORTED_FILE };
  }
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

  const bytes = new File(source.uri).size;
  const plan = imagePlan(kind, bytes > 0 ? bytes : null, source.width ?? 0, source.height ?? 0);
  if (plan.action === "refuse") {
    return { ok: false, message: plan.message };
  }
  if (plan.action === "keep-png") {
    const name = uploadName("png", source.name);
    const file = namedCopy(source.uri, name);
    return { ok: true, file: { uri: file.uri, name, type: contentType("png"), bytes: file.size, preview: true } };
  }

  for (const step of plan.steps) {
    const fitted = fittedEdge(source.width ?? 0, source.height ?? 0, step.longest);
    const context = ImageManipulator.manipulate(source.uri);
    if (fitted.width !== source.width || fitted.height !== source.height) {
      context.resize({ width: fitted.width });
    }
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ compress: step.quality, format: SaveFormat.JPEG });
    const savedFile = new File(saved.uri);
    if (savedFile.size > 0 && savedFile.size <= MAX_EVIDENCE_BYTES) {
      const name = uploadName("jpeg", source.name);
      const file = namedCopy(saved.uri, name);
      return { ok: true, file: { uri: file.uri, name, type: contentType("jpeg"), bytes: file.size, preview: true } };
    }
  }
  return { ok: false, message: PHOTO_TOO_LARGE };
}
