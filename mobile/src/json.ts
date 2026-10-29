/** Object and string readers for hall JSON. `record` returns null for a list. `isRecord` is true for any non-null object, including a list. */

export type Json = Record<string, unknown>;

export function record(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
}

export function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null;
}
