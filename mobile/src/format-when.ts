const whenFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hourCycle: "h12",
});

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((item) => item.type === type)?.value ?? "";
}

/** Hall clock: `05 September 2026, 7:00 PM` in Asia/Kolkata. */
export function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const parts = whenFormat.formatToParts(date);
  const hour = String(Number(part(parts, "hour")));
  const marker = part(parts, "dayPeriod").toUpperCase();
  return `${part(parts, "day")} ${part(parts, "month")} ${part(parts, "year")}, ${hour}:${part(parts, "minute")} ${marker}`;
}

/** UTC instant the hall accepts: `YYYY-MM-DDTHH:MM:SSZ`, to the minute. */
export function utcInstant(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:00Z`
  );
}
