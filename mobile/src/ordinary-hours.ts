/** Posted ordinary-hours clocks from resident home. Cleared on sign-out. */

export type OrdinaryHours = {
  summerOutingStart: string;
  summerOutingEnd: string;
  winterOutingStart: string;
  winterOutingEnd: string;
  summerSeasonStart: string;
  winterSeasonStart: string;
};

let cached: OrdinaryHours | null = null;

export function rememberOrdinaryHours(next: OrdinaryHours): void {
  cached = next;
}

export function readOrdinaryHoursCache(): OrdinaryHours | null {
  return cached;
}

export function forgetOrdinaryHours(): void {
  cached = null;
}

export function readOrdinaryHours(value: unknown): OrdinaryHours | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const body = value as Record<string, unknown>;
  const summerOutingStart = clockField(body.summer_outing_start);
  const summerOutingEnd = clockField(body.summer_outing_end);
  const winterOutingStart = clockField(body.winter_outing_start);
  const winterOutingEnd = clockField(body.winter_outing_end);
  const summerSeasonStart = seasonField(body.summer_season_start);
  const winterSeasonStart = seasonField(body.winter_season_start);
  if (
    !summerOutingStart ||
    !summerOutingEnd ||
    !winterOutingStart ||
    !winterOutingEnd ||
    !summerSeasonStart ||
    !winterSeasonStart
  ) {
    return null;
  }
  return {
    summerOutingStart,
    summerOutingEnd,
    winterOutingStart,
    winterOutingEnd,
    summerSeasonStart,
    winterSeasonStart,
  };
}

function clockField(value: unknown): string | null {
  return typeof value === "string" && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value) ? value : null;
}

function seasonField(value: unknown): string | null {
  return typeof value === "string" && /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(value)
    ? value
    : null;
}
