/**
 * Share a local file through the system sheet.
 * Hides expo-file-system and expo-sharing behind one surface.
 */

import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

export type ShareFileResult = "shared" | "unavailable" | "failed";

/** Write UTF-8 text into the cache and return its file URI. */
export async function writeCacheText(filename: string, body: string): Promise<string> {
  const dest = new File(Paths.cache, filename);
  if (dest.exists) {
    dest.delete();
  }
  dest.create();
  dest.write(body);
  return dest.uri;
}

/** Open the native share sheet for a file URI (WhatsApp, Files, Mail, …). */
export async function shareLocalFile(
  uri: string,
  options: { mimeType: string; uti: string; dialogTitle: string },
): Promise<ShareFileResult> {
  if (!(await Sharing.isAvailableAsync())) {
    return "unavailable";
  }
  try {
    await Sharing.shareAsync(uri, {
      mimeType: options.mimeType,
      UTI: options.uti,
      dialogTitle: options.dialogTitle,
    });
    return "shared";
  } catch {
    return "failed";
  }
}
