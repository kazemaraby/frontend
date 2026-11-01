import { Construction } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";

import { Card } from "@/design/Card";
import { Page } from "@/layout/Page";
import { FOOTER_NAV, MAIN_NAV } from "@/layout/nav";

/** Placeholder for modules that get their screens in later phases. */
export default function ComingSoonPage() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const item = [...MAIN_NAV, ...FOOTER_NAV].find((n) => n.to === pathname);
  const title = item ? t(`nav.${item.id}`) : t("common.notFound");
  return (
    <Page title={title}>
      <Card className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-teal-soft text-teal-dark">
          <Construction aria-hidden="true" className="size-7" />
        </span>
        <p className="text-lg font-semibold">{item ? t("common.comingSoon") : t("common.notFound")}</p>
        <p className="max-w-md text-muted">{item ? t("common.comingSoonBody") : t("common.notFoundBody")}</p>
      </Card>
    </Page>
  );
}
