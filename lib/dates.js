// Calendar days are handled as "YYYY-MM-DD" text in the browser's own time zone, so a day never
// shifts because of UTC conversion.

const pad = (n) => String(n).padStart(2, "0");
export const keyOf = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const todayKey = () => keyOf(new Date());

const parse = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (key, n) => {
  const d = parse(key);
  d.setDate(d.getDate() + n);
  return keyOf(d);
};

/** The 7 days (Monday first) of the week that contains `key`. */
export function weekOf(key) {
  const d = parse(key);
  const offset = (d.getDay() + 6) % 7; // Monday = 0
  const monday = addDays(key, -offset);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const full = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });
const dateTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const timeOnly = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

export const weekdayShort = (key) => weekday.format(parse(key));
export const dayNumber = (key) => parse(key).getDate();
export const fullDate = (key) => full.format(parse(key));
export const fmtDateTime = (iso) => dateTime.format(new Date(iso));
export const fmtTime = (iso) => timeOnly.format(new Date(iso));

/** "Today", "Yesterday", "Tomorrow" or "Mon 3 Nov". */
export function dayLabel(key, today) {
  if (key === today) return "Today";
  if (key === addDays(today, -1)) return "Yesterday";
  if (key === addDays(today, 1)) return "Tomorrow";
  return `${weekday.format(parse(key))} ${dayMonth.format(parse(key))}`;
}

/** "5 minutes ago", "3 days ago", or a date for older times. */
export function timeAgo(iso) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 90) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  if (seconds < 86400 * 14) return `${Math.round(seconds / 86400)} days ago`;
  return dayMonth.format(new Date(iso));
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** Display order, Monday first, as API weekday numbers (0 = Sunday). */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
