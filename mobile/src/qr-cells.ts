import QRCode from "qrcode";

/** Module grid for the hall-pass payload. Same library and error correction as the on-screen SVG fallback. */
export function qrCells(value: string): { count: number; bits: string } | null {
  let created: ReturnType<typeof QRCode.create>;
  try {
    created = QRCode.create(value, { errorCorrectionLevel: "M" });
  } catch {
    return null;
  }
  const count = created.modules.size;
  const data = created.modules.data;
  if (count <= 0 || data.length !== count * count) {
    return null;
  }
  let bits = "";
  for (let index = 0; index < data.length; index += 1) {
    bits += data[index] ? "1" : "0";
  }
  return { count, bits };
}
