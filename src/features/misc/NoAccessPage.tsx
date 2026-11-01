import { ShieldOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { useSession } from "@/auth/session";
import { Card } from "@/design/Card";
import { Page } from "@/layout/Page";
import { useFormat } from "@/lib/useFormat";

/** 403: the screen exists but the user's roles don't cover it in the active company. */
export default function NoAccessPage({ reason }: { reason?: "plan" }) {
  const { t } = useTranslation();
  const format = useFormat();
  const { company } = useSession();
  return (
    <Page title={t("noAccess.title")}>
      <Card className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-danger-soft text-danger">
          <ShieldOff aria-hidden="true" className="size-7" />
        </span>
        <p className="text-lg font-semibold">{reason === "plan" ? t("noAccess.notInPlanHeading") : t("noAccess.heading")}</p>
        <p className="max-w-md text-muted">
          {reason === "plan"
            ? t("noAccess.notInPlanBody")
            : company
              ? t("noAccess.body", { company: format.name(company) })
              : t("noAccess.noCompany")}
        </p>
        <Link to="/" className="font-semibold text-teal-dark hover:underline">
          {t("noAccess.backHome")}
        </Link>
      </Card>
    </Page>
  );
}
