export const TIMEZONE = "Asia/Kolkata";

export const WEEKDAYS = [
  { value: 1, short: "Mon" },
  { value: 2, short: "Tue" },
  { value: 3, short: "Wed" },
  { value: 4, short: "Thu" },
  { value: 5, short: "Fri" },
  { value: 6, short: "Sat" },
  { value: 0, short: "Sun" },
] as const;

/** Today's date in India as YYYY-MM-DD. */
export function todayIST(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(now);
}

/** Day of week (0 = Sunday) for a YYYY-MM-DD date. */
export function weekdayOf(isoDate: string): number {
  return new Date(`${isoDate}T12:00:00Z`).getUTCDay();
}

/** "16:00:00" → "4:00 PM" */
export function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Current date, weekday and minutes-since-midnight in India. */
export function nowIST(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  return { date, weekday: weekdayOf(date), minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

/** "16:30:00" → 990 */
export function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Time of day in India for a timestamp, e.g. "4:02 PM". */
export function formatClockIST(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: TIMEZONE, hour: "numeric", minute: "2-digit", hour12: true })
    .format(new Date(iso))
    .toUpperCase();
}

export function formatDays(days: number[]): string {
  if (days.length === 7) return "Every day";
  return WEEKDAYS.filter((d) => days.includes(d.value))
    .map((d) => d.short)
    .join(", ");
}
