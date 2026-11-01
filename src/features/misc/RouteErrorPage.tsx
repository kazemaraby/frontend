import { TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useRouteError } from "react-router";

import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { Page } from "@/layout/Page";

/** Shown inside the app shell when a screen throws while rendering, instead of a blank page. */
export default function RouteErrorPage() {
  const { t } = useTranslation();
  const error = useRouteError();
  if (import.meta.env.DEV) console.error(error);
  return (
    <Page title={t("routeError.title")}>
      <Card className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-danger-soft text-danger">
          <TriangleAlert aria-hidden="true" className="size-7" />
        </span>
        <p className="text-lg font-semibold">{t("routeError.heading")}</p>
        <p className="max-w-md text-muted">{t("routeError.body")}</p>
        <div className="flex gap-3">
          <Button onClick={() => window.location.reload()}>{t("common.retry")}</Button>
          <Link to="/" className="inline-flex items-center font-semibold text-teal-dark hover:underline">
            {t("noAccess.backHome")}
          </Link>
        </div>
      </Card>
    </Page>
  );
}
