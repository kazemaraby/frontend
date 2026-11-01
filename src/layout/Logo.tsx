import { useTranslation } from "react-i18next";

import { cn } from "@/design/cn";

/** The SSS HR System mark: public/logo.svg, a vector redraw of the brand logo (docs/brand). */
export function Logo({ className }: { className?: string }) {
  const { t } = useTranslation();
  return <img src="/logo.svg" alt={t("app.name")} draggable={false} className={cn("size-11 object-contain", className)} />;
}
