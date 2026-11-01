import { useTranslation } from "react-i18next";

/** "7:30" from minutes. */
export const hm = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;

/** "06:00" in the day's time zone (the branch's). */
export function useClock() {
  const { i18n } = useTranslation();
  const locale = i18n.language === "ar" ? "ar-u-nu-latn" : "en-GB";
  return (iso: string | null, zone: string) =>
    iso
      ? new Intl.DateTimeFormat(locale, {
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23", // 24-hour: AM/PM marks would reorder inside the left-to-right span
          timeZone: zone,
        }).format(new Date(iso))
      : "—";
}
