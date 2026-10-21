/** A decoded JSON object from a hall response. */
export type Json = Record<string, unknown>;

/** The value as an object, or null for an array, a primitive, or null. */
export function record(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
}

/** The value when it is a string, otherwise null. */
export function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
