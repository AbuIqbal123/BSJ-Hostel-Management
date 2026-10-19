/** A clock span that names two hall days. `7:00 PM to 11:00 PM, 05 October` does not. */
export function crossesMidnight(when: string): boolean {
  const toAt = when.indexOf(" to ");
  const commaAt = when.indexOf(", ");
  return commaAt >= 0 && toAt > commaAt;
}

/**
 * How a History date sits in the row.
 * At the default text size only a cross-midnight span wraps, and only to two lines.
 * Above that, every date may use as many lines as it needs.
 */
export function historyPartsLayout(
  when: string,
  fontScale: number,
): { keepParts?: number; wrapLines?: number } {
  if (!(fontScale > 1)) {
    return crossesMidnight(when) ? { keepParts: 0 } : {};
  }
  return { keepParts: 0, wrapLines: 0 };
}

/** Above the default text size the place leaves the kind's line, so the kind is never cut. */
export function requestsPlaceOnOwnLine(partCount: number, fontScale: number): boolean {
  return fontScale > 1 && partCount > 1;
}
