import { Building2, CalendarCog, UsersRound, Clock, ChevronLeft, ChevronRight, ClipboardList, FileText, KeyRound, ListTree, Plane, Receipt, Route, ShieldCheck, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { useSession } from "@/auth/session";
import { Card } from "@/design/Card";
import NoAccess from "@/features/misc/NoAccessPage";
import { Page } from "@/layout/Page";
import { useFormat } from "@/lib/useFormat";

const ITEMS = [
  { to: "/settings/setup", icon: Building2, permission: "core.manage_companies", key: "setup" },
  { to: "/settings/users", icon: UsersRound, permission: "core.manage_users", key: "users" },
  { to: "/settings/master-data", icon: ListTree, permission: "core.manage_master_data", key: "master" },
  { to: "/settings/workflows", icon: Route, permission: "workflow.manage", key: "workflows" },
  { to: "/settings/leave", icon: ClipboardList, permission: "leave.manage_types", key: "leave" },
  { to: "/settings/travel", icon: Plane, permission: "selfservice.manage_travel", key: "travel" },
  { to: "/settings/letters", icon: FileText, permission: "selfservice.manage_letters", key: "letters" },
  { to: "/settings/holidays", icon: CalendarCog, permission: "leave.manage_calendar", key: "holidays" },
  { to: "/settings/attendance", icon: Clock, permission: "attendance.manage", key: "attendance" },
  { to: "/settings/payroll", icon: Wallet, permission: "payroll.manage_settings", key: "payroll" },
  { to: "/settings/compliance", icon: ShieldCheck, permission: "compliance.manage", key: "compliance" },
  { to: "/settings/billing", icon: Receipt, permission: "core.manage_billing", key: "billing" },
  { to: "/settings/api", icon: KeyRound, permission: "api.manage_webhooks", key: "api" },
] as const;

/** /settings — the settings the user may change. */
export default function SettingsPage() {
  const { t } = useTranslation();
  const format = useFormat();
  const { can } = useSession();
  const items = ITEMS.filter((item) => can(item.permission));
  if (!items.length) return <NoAccess />;
  const Chevron = format.dir === "rtl" ? ChevronLeft : ChevronRight;
  return (
    <Page title={t("settings.title")}>
      <div className="grid gap-4 md:grid-cols-2">
        {items.map(({ to, icon: Icon, key }) => (
          <Link key={to} to={to} className="group block rounded-panel focus-visible:outline-2 focus-visible:outline-teal-dark">
            <Card variant="solid" className="flex h-full items-center gap-4 transition-shadow group-hover:shadow-pop">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-teal-soft text-teal-dark">
                <Icon aria-hidden="true" className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-semibold text-ink">{t(`settings.${key}.title`)}</span>
                <span className="block text-sm text-muted">{t(`settings.${key}.body`)}</span>
              </span>
              <Chevron aria-hidden="true" className="size-5 text-muted" />
            </Card>
          </Link>
        ))}
      </div>
    </Page>
  );
}
