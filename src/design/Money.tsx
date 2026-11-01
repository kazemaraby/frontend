import { useTranslation } from "react-i18next";

import { useFormat } from "@/lib/useFormat";

import { cn } from "./cn";
import { RiyalSign } from "./RiyalSign";

type Props = {
  /** Decimal string from the API ("149735.00"). Numbers are accepted for counts only. */
  amount: string | number;
  currency?: string;
  /** Fixed decimals; by default up to 2 are shown and trailing zeros dropped. */
  fractionDigits?: number | [number, number];
  className?: string;
  signClassName?: string;
};

/** Amount + currency. The sign always sits to the left of the figure (as in the designs), in both directions. */
export function Money({ amount, currency = "SAR", fractionDigits = [0, 2], className, signClassName }: Props) {
  const { t } = useTranslation();
  const format = useFormat();
  return (
    <span dir="ltr" className={cn("num inline-flex items-baseline gap-[0.3em] whitespace-nowrap", className)}>
      {currency === "SAR" ? (
        <RiyalSign className={cn("h-[0.78em] w-auto shrink-0 self-center opacity-80", signClassName)} />
      ) : (
        <span className={cn("text-[0.7em] font-medium opacity-80", signClassName)}>{currency}</span>
      )}
      <span>{format.number(amount, fractionDigits)}</span>
      <span className="sr-only">{currency === "SAR" ? t("currency.SAR") : currency}</span>
    </span>
  );
}
