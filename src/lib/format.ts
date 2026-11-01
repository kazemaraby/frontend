/** Locale-aware formatting. Both languages use Western digits and the Gregorian calendar (as in the designs);
 * Hijri is available alongside for iqama and contract dates. Money arrives as a decimal string and is never
 * turned into a float for arithmetic, only handed to Intl for display. */

export type Lang = "ar" | "en";

const LOCALE: Record<Lang, string> = {
  ar: "ar-u-ca-gregory-nu-latn",
  en: "en-GB-u-ca-gregory-nu-latn",
};
const HIJRI_LOCALE: Record<Lang, string> = {
  ar: "ar-SA-u-ca-islamic-umalqura-nu-latn",
  en: "en-GB-u-ca-islamic-umalqura-nu-latn",
};

export const localeFor = (lang: Lang) => LOCALE[lang];

/** "2026-10-21" → local midnight (new Date("2026-10-21") would be UTC midnight and can shift a day).
 * A full timestamp ("2026-10-21T09:30:00+03:00") is parsed as such. */
export function parseDate(iso: string): Date {
  if (iso.length > 10) return new Date(iso);
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toISODate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

type NumberInput = number | `${number}` | string;

export function formatNumber(value: NumberInput, lang: Lang, fractionDigits?: number | [number, number]) {
  const [min, max] = Array.isArray(fractionDigits) ? fractionDigits : [fractionDigits ?? 0, fractionDigits ?? 2];
  // Intl formats decimal strings exactly (no float rounding of e.g. "1000000.63").
  return new Intl.NumberFormat(LOCALE[lang], { minimumFractionDigits: min, maximumFractionDigits: max }).format(
    value as Intl.StringNumericLiteral,
  );
}

const dateOptions = {
  day: { day: "numeric" },
  dayMonth: { day: "numeric", month: "long" },
  dayMonthYear: { day: "numeric", month: "long", year: "numeric" },
  monthYear: { month: "long", year: "numeric" },
  month: { month: "long" },
  weekday: { weekday: "long" },
  short: { day: "2-digit", month: "2-digit", year: "numeric" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;
export type DateStyle = keyof typeof dateOptions;

export function formatDate(date: Date | string, lang: Lang, style: DateStyle = "dayMonthYear") {
  const value = typeof date === "string" ? parseDate(date) : date;
  return new Intl.DateTimeFormat(LOCALE[lang], dateOptions[style]).format(value);
}

export function formatHijri(date: Date | string, lang: Lang) {
  const value = typeof date === "string" ? parseDate(date) : date;
  return new Intl.DateTimeFormat(HIJRI_LOCALE[lang], dateOptions.dayMonthYear).format(value);
}

/** The Umm al-Qura day of the month ("10"), for calendar cells. */
export function formatHijriDay(date: Date, lang: Lang) {
  return new Intl.DateTimeFormat(HIJRI_LOCALE[lang], { day: "numeric" }).format(date);
}

/** "ربيع الآخر 1448" — the Umm al-Qura month and year. */
export function formatHijriMonth(date: Date, lang: Lang) {
  return new Intl.DateTimeFormat(HIJRI_LOCALE[lang], { month: "long", year: "numeric" }).format(date);
}

/** "19 أكتوبر – 29 أكتوبر 2026"; a single day when start == end. */
export function formatDateRange(start: string, end: string, lang: Lang) {
  if (start === end) return formatDate(start, lang);
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  return `${formatDate(start, lang, sameYear ? "dayMonth" : "dayMonthYear")} – ${formatDate(end, lang)}`;
}

/** "08:30" → "08:30 ص" / "08:30 am". */
export function formatTime(hhmm: string, lang: Lang) {
  const [h, m] = hhmm.split(":").map(Number);
  return new Intl.DateTimeFormat(LOCALE[lang], { hour: "2-digit", minute: "2-digit", hour12: true }).format(
    new Date(2000, 0, 1, h, m),
  );
}

export function formatTimeRange(from: string, to: string, lang: Lang) {
  return `${formatTime(from, lang)} – ${formatTime(to, lang)}`;
}

/** "منذ 5 دقائق" / "5 minutes ago"; falls back to the date after a week. */
export function formatRelative(iso: string, lang: Lang, now: Date = new Date()) {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(LOCALE[lang], { numeric: "auto" });
  const abs = Math.abs(seconds);
  if (abs < 60) return rtf.format(0, "second");
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 7 * 86400) return rtf.format(Math.round(seconds / 86400), "day");
  return formatDate(new Date(iso), lang);
}

export function monthNames(lang: Lang, style: "long" | "short" = "long") {
  const format = new Intl.DateTimeFormat(LOCALE[lang], { month: style });
  return Array.from({ length: 12 }, (_, i) => format.format(new Date(2026, i, 1)));
}
