import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Outlet, useLocation } from "react-router";

import { Button } from "@/design/Button";
import NoAccess from "@/features/misc/NoAccessPage";
import { Logo } from "@/layout/Logo";

import { useSession } from "./session";

export function Splash({ error, onRetry }: { error?: boolean; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-dvh place-items-center p-6" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4 text-center">
        <Logo className={error ? "size-14" : "size-14 animate-pulse"} />
        <p className="text-muted">{error ? t("session.loadFailed") : t("common.loading")}</p>
        {error && onRetry && <Button onClick={onRetry}>{t("common.retry")}</Button>}
      </div>
    </div>
  );
}

/** Layout route: signed-in users pass through; others go to /login and come back afterwards. */
export function RequireAuth() {
  const session = useSession();
  const location = useLocation();
  if (session.status === "loading") return <Splash />;
  if (session.status === "error") return <Splash error onRetry={session.retry} />;
  if (session.status === "anonymous") {
    // After an expired session, come back to the same page; after signing out, start fresh.
    const next = location.pathname + location.search;
    const keep = !session.signedOutByUser && next !== "/";
    return <Navigate to={keep ? `/login?next=${encodeURIComponent(next)}` : "/login"} replace />;
  }
  return <Outlet />;
}

/** Shows the "no access" page in place of a screen that is outside the plan, or that the user has no
 * permission for in the active company. */
export function RequirePermission({ code, module, children }: { code?: string; module?: string; children: ReactNode }) {
  const { can, hasModule } = useSession();
  if (!hasModule(module)) return <NoAccess reason="plan" />;
  return can(code) ? children : <NoAccess />;
}
