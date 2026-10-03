const hallParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return (parts.find((item) => item.type === type)?.value ?? "").replace(/\D/g, "");
}

function whenPieces(iso: string): { day: string; clock: string } | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const parts = hallParts.formatToParts(date);
  const day = Number(part(parts, "day"));
  const month = Number(part(parts, "month"));
  const year = part(parts, "year");
  const hour24 = Number(part(parts, "hour"));
  const minute = part(parts, "minute");
  if (
    !Number.isInteger(day) ||
    day < 1 ||
    month < 1 ||
    month > 12 ||
    year.length !== 4 ||
    !Number.isInteger(hour24) ||
    hour24 > 23 ||
    minute.length === 0
  ) {
    return null;
  }
  const marker = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return {
    day: `${day} ${MONTHS[month - 1]} ${year}`,
    clock: `${hour12}:${minute.padStart(2, "0")} ${marker}`,
  };
}

/** Hall clock: `5 September 2026, 7:00 PM` in Asia/Kolkata. */
export function formatWhen(iso: string): string {
  const pieces = whenPieces(iso);
  if (!pieces) {
    return iso;
  }
  return `${pieces.day}, ${pieces.clock}`;
}

export function formatWhenParts(iso: string): { day: string; clock: string } | null {
  return whenPieces(iso);
}

/** UTC instant the hall accepts: `YYYY-MM-DDTHH:MM:SSZ`, to the minute. */
export function utcInstant(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:00Z`
  );
}
