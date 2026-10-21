/** The first Expo Router search param, or an empty string when it is missing. */
export function paramText(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw ?? "";
}
