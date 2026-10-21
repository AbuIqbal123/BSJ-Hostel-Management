/** Object and string readers for hall JSON. A list is not a record. */

export type Json = Record<string, unknown>;

export function record(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
}

export function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
