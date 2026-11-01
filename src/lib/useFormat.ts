import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import * as f from "./format";

/** The formatting helpers bound to the active language (or the nearest I18nextProvider's). */
export function useFormat() {
  const { i18n } = useTranslation();
  const lang = (i18n.language === "en" ? "en" : "ar") as f.Lang;
  return useMemo(
    () => ({
      lang,
      dir: lang === "ar" ? ("rtl" as const) : ("ltr" as const),
      number: (v: string | number, digits?: number | [number, number]) => f.formatNumber(v, lang, digits),
      date: (d: Date | string, style?: f.DateStyle) => f.formatDate(d, lang, style),
      hijri: (d: Date | string) => f.formatHijri(d, lang),
      hijriDay: (d: Date) => f.formatHijriDay(d, lang),
      hijriMonth: (d: Date) => f.formatHijriMonth(d, lang),
      dateRange: (a: string, b: string) => f.formatDateRange(a, b, lang),
      time: (t: string) => f.formatTime(t, lang),
      timeRange: (a: string, b: string) => f.formatTimeRange(a, b, lang),
      months: (style?: "long" | "short") => f.monthNames(lang, style),
      relative: (iso: string) => f.formatRelative(iso, lang),
      /** Pick the language's side of a {ar, en} pair or an object with title_ar / title_en. */
      pick: (value: { ar: string; en: string }) => (lang === "en" ? value.en || value.ar : value.ar || value.en),
      /** Picks name_ar / name_en (falls back to the other language when one is blank). */
      name: (o: { name_ar: string; name_en?: string }) => (lang === "en" ? o.name_en || o.name_ar : o.name_ar || o.name_en || ""),
    }),
    [lang],
  );
}
