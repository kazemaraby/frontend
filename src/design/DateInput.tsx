import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { hr } from "@/api/hr";
import { normalizeDigits } from "@/lib/validators";
import { useFormat } from "@/lib/useFormat";

import { cn } from "./cn";
import { FieldMessage } from "./Field";

type Props = {
  label: string;
  /** ISO Gregorian date ("2026-10-21") or null. Dates are always stored Gregorian (CLAUDE.md). */
  value: string | null;
  onChange: (iso: string | null) => void;
  /** Iqama, contract and document dates: show the Hijri date alongside and allow typing it in Hijri. */
  hijri?: boolean;
  error?: string | null;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  name?: string;
  className?: string;
};

/** Numeric Umm al-Qura parts of a Gregorian date, from the browser (display only). */
function hijriParts(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(y, m - 1, d));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Date field: Gregorian picker, with the Hijri date shown alongside and an optional Hijri entry mode. */
export function DateInput({ label, value, onChange, hijri = false, error, hint, required, disabled, min, max, name, className }: Props) {
  const { t } = useTranslation();
  const format = useFormat();
  const id = useId();
  const [mode, setMode] = useState<"gregorian" | "hijri">("gregorian");
  const [hijriText, setHijriText] = useState("");
  const [hijriError, setHijriError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    if (mode === "hijri") setHijriText(value ? hijriParts(value) : "");
  }, [mode, value]);

  async function commitHijri(text: string) {
    const typed = normalizeDigits(text.trim()).replace(/\//g, "-");
    setHijriError(null);
    if (!typed) return onChange(null);
    if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(typed)) return setHijriError(t("dateInput.hijriFormat"));
    setConverting(true);
    try {
      const { gregorian } = await hr.convertDate({ hijri: typed });
      onChange(gregorian);
    } catch {
      setHijriError(t("dateInput.hijriInvalid"));
    } finally {
      setConverting(false);
    }
  }

  const message = error ?? hijriError;
  const readout =
    value && hijri
      ? mode === "gregorian"
        ? t("dateInput.inHijri", { date: format.hijri(value) })
        : t("dateInput.inGregorian", { date: format.date(value) })
      : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {hijri && (
          <div role="group" aria-label={t("dateInput.calendarFor", { label })} className="flex rounded-full bg-neutral-soft p-0.5 text-xs">
            {(["gregorian", "hijri"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={cn("cursor-pointer rounded-full px-2.5 py-1", mode === m ? "bg-white font-semibold shadow-soft" : "text-muted")}
              >
                {t(`dateInput.${m}`)}
              </button>
            ))}
          </div>
        )}
      </div>
      {mode === "gregorian" ? (
        <input
          id={id}
          name={name}
          type="date"
          value={value ?? ""}
          min={min}
          max={max}
          required={required}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value || null)}
          aria-invalid={message ? true : undefined}
          aria-describedby={`${id}-message`}
          className={cn(
            "num h-12 w-full rounded-full border bg-white px-5 text-[15px] text-ink focus:border-teal-dark focus:outline-none disabled:opacity-60",
            message ? "border-danger" : "border-line",
          )}
        />
      ) : (
        <input
          id={id}
          name={name ? `${name}_hijri` : undefined}
          inputMode="numeric"
          dir="ltr"
          placeholder={t("dateInput.hijriPlaceholder")}
          value={hijriText}
          required={required}
          aria-busy={converting}
          onChange={(e) => setHijriText(e.target.value)}
          onBlur={(e) => commitHijri(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void commitHijri(e.currentTarget.value);
            }
          }}
          aria-invalid={message ? true : undefined}
          aria-describedby={`${id}-message`}
          className={cn(
            "num h-12 w-full rounded-full border bg-white px-5 text-end text-[15px] text-ink focus:border-teal-dark focus:outline-none",
            message ? "border-danger" : "border-line",
          )}
        />
      )}
      <FieldMessage id={`${id}-message`} error={message} hint={readout ?? hint} />
    </div>
  );
}
