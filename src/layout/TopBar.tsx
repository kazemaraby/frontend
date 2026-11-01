import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, ChevronDown, Download, Grip, Languages, LogOut, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import { type AppNotification, endpoints, type MeCompany } from "@/api";
import { displayName, useSession } from "@/auth/session";
import { Avatar } from "@/design/Avatar";
import { cn } from "@/design/cn";
import { Menu, MenuItem } from "@/design/Menu";
import { useInstallPrompt } from "@/lib/pwa";
import { useFormat } from "@/lib/useFormat";

import { GlobalSearch } from "./GlobalSearch";
import { MAIN_NAV } from "./nav";

const circle = "relative inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-ink transition-colors hover:bg-neutral-soft sm:size-11";

/** The company's logo (branding, #18) or its initial. */
function CompanyMark({ company, small = false }: { company: MeCompany; small?: boolean }) {
  const format = useFormat();
  if (company.logo) {
    return (
      <img
        src={company.logo}
        alt=""
        className={cn("shrink-0 rounded-full bg-white object-contain ring-1 ring-line", small ? "size-5" : "size-8")}
      />
    );
  }
  return <Avatar name={format.name(company)} tone="forest" size={small ? "2xs" : "xs"} />;
}

/** Lists the user's companies (from /me) with their branches; the choice is sent as X-Company-Id / X-Branch-Id. */
function CompanySwitcher() {
  const { t } = useTranslation();
  const format = useFormat();
  const { companies, company, branch, selectCompany } = useSession();

  if (!company) {
    return (
      <span className="flex h-10 items-center rounded-full bg-white px-4 text-sm text-muted sm:h-11">{t("topbar.noCompany")}</span>
    );
  }

  const companyName = format.name(company);
  return (
    <Menu
      align="start"
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-label={t("topbar.switchCompany", { company: companyName })}
          className="flex h-10 w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-full bg-white ps-1.5 pe-4 transition-colors hover:bg-neutral-soft sm:h-11 md:w-auto"
        >
          <CompanyMark company={company} />
          <span className="truncate text-[15px] font-semibold">{companyName}</span>
          <span aria-hidden="true" className="hidden h-5 w-px shrink-0 bg-line-strong sm:block" />
          <span className="hidden truncate text-[15px] text-muted sm:block">
            {branch ? format.name(branch) : t("topbar.allBranches")}
          </span>
          <ChevronDown aria-hidden="true" className="ms-auto size-4 shrink-0 sm:ms-1" />
        </button>
      )}
    >
      {(close) => (
        <div className="max-h-[70dvh] w-72 overflow-y-auto">
          {companies.map((c) => (
            <div key={c.id} role="group" aria-label={format.name(c)} className="mb-1 last:mb-0">
              <p aria-hidden="true" className="flex items-center gap-2 px-3 pb-1 pt-2 text-xs font-semibold text-muted">
                <CompanyMark company={c} small />
                {format.name(c)}
              </p>
              {[null, ...c.branches].map((b) => {
                const active = company.id === c.id && (branch?.id ?? null) === (b?.id ?? null);
                return (
                  <MenuItem
                    key={b?.id ?? "all"}
                    active={active}
                    icon={<Check aria-hidden="true" className={cn("size-4", !active && "invisible")} />}
                    onSelect={() => {
                      selectCompany(c.id, b?.id ?? null);
                      close();
                    }}
                  >
                    {b ? format.name(b) : t("topbar.allBranches")}
                  </MenuItem>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </Menu>
  );
}

/** Bell with the unread count (red badge), refreshed every minute. Opening a notification marks it read, switches
 * to its company when needed and goes to its link. */
function Notifications() {
  const { t } = useTranslation();
  const format = useFormat();
  const unread = useQuery({ queryKey: ["notifications", "unread"], queryFn: endpoints.unreadCount, refetchInterval: 60_000 });
  const count = unread.data?.count ?? 0;
  return (
    <Menu
      align="end"
      trigger={(props) => (
        <button type="button" {...props} aria-label={t("topbar.notifications", { count })} className={circle}>
          <Bell aria-hidden="true" className="size-5" strokeWidth={1.75} />
          {count > 0 && (
            <span
              aria-hidden="true"
              className="num absolute -end-1 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-badge px-1.5 text-xs font-bold text-white"
            >
              {count > 99 ? "99+" : format.number(count)}
            </span>
          )}
        </button>
      )}
    >
      {(close) => <NotificationList close={close} unread={count} />}
    </Menu>
  );
}

function NotificationList({ close, unread }: { close: () => void; unread: number }) {
  const { t } = useTranslation();
  const format = useFormat();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { company, selectCompany } = useSession();
  const list = useQuery({ queryKey: ["notifications", "latest"], queryFn: () => endpoints.notifications({ page_size: 8 }) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });
  const readAll = useMutation({ mutationFn: endpoints.markAllRead, onSuccess: refresh });

  async function open(n: AppNotification) {
    close();
    if (!n.read) void endpoints.markRead(n.id).then(refresh);
    if (n.company && n.company !== company?.id) selectCompany(n.company, null);
    if (n.url) navigate(n.url);
  }

  const items = list.data?.results ?? [];
  return (
    <div className="w-80 max-w-[calc(100vw-2rem)]">
      <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-1">
        <p className="text-sm font-semibold">{t("topbar.notificationsTitle")}</p>
        {unread > 0 && (
          <button type="button" onClick={() => readAll.mutate()} className="cursor-pointer text-xs font-semibold text-teal-dark hover:underline">
            {t("notifications.markAllRead")}
          </button>
        )}
      </div>
      {list.isPending ? (
        <p className="px-3 py-4 text-sm text-muted">{t("common.loading")}</p>
      ) : items.length === 0 ? (
        <p className="px-3 py-4 text-sm text-muted">{t("topbar.noNotifications")}</p>
      ) : (
        <ul className="max-h-[60dvh] overflow-y-auto">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => void open(n)}
                className="flex w-full cursor-pointer gap-2.5 rounded-xl px-3 py-2.5 text-start hover:bg-neutral-soft"
              >
                <span aria-hidden="true" className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-teal-dark")} />
                <span className="min-w-0">
                  <span className={cn("block text-sm text-ink", !n.read && "font-semibold")}>{format.pick({ ar: n.title_ar, en: n.title_en })}</span>
                  {(n.body_ar || n.body_en) && (
                    <span className="mt-0.5 block text-xs text-muted">{format.pick({ ar: n.body_ar, en: n.body_en })}</span>
                  )}
                  <span className="num mt-1 block text-xs text-subtle">{format.relative(n.created_at)}</span>
                </span>
                {!n.read && <span className="sr-only">{t("notifications.unread")}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-1 border-t border-line pt-1">
        <Link to="/notifications" onClick={close} className="block rounded-xl px-3 py-2 text-center text-sm font-semibold text-teal-dark hover:bg-neutral-soft">
          {t("common.viewAll")}
        </Link>
      </div>
    </div>
  );
}

function AppsMenu() {
  const { t } = useTranslation();
  const { can, hasModule } = useSession();
  return (
    <Menu
      align="end"
      trigger={(props) => (
        <button type="button" {...props} aria-label={t("topbar.apps")} className={circle}>
          <Grip aria-hidden="true" className="size-5" strokeWidth={1.75} />
        </button>
      )}
    >
      {(close) => (
        <ul className="grid w-72 grid-cols-3 gap-1">
          {MAIN_NAV.filter((item) => hasModule(item.module) && can(item.permission)).map((item) => (
            <li key={item.id}>
              <Link
                to={item.to}
                onClick={close}
                className="flex flex-col items-center gap-1.5 rounded-xl p-3 text-center text-xs text-ink hover:bg-neutral-soft"
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-teal-soft text-teal-dark">
                  <item.icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
                </span>
                {t(`nav.${item.id}`)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Menu>
  );
}

function AccountMenu() {
  const { t, i18n } = useTranslation();
  const { me, setLanguage, logout } = useSession();
  const install = useInstallPrompt();
  if (!me) return null;
  const name = displayName(me, i18n.language);
  return (
    <Menu
      align="end"
      trigger={(props) => (
        <button type="button" {...props} aria-label={t("topbar.account", { name })} className="shrink-0 cursor-pointer rounded-full ring-2 ring-white">
          <Avatar name={name} tone="peach" size="responsive" />
        </button>
      )}
    >
      {(close) => (
        <div className="w-64">
          <div className="border-b border-line px-3 pb-3 pt-1">
            <p className="font-semibold">{name}</p>
            <p className="truncate text-sm text-muted" dir="ltr">
              {me.email}
            </p>
          </div>
          <p className="flex items-center gap-2 px-3 pb-1 pt-3 text-xs font-semibold text-muted">
            <Languages aria-hidden="true" className="size-4" />
            {t("topbar.language")}
          </p>
          {(["ar", "en"] as const).map((lng) => (
            <MenuItem
              key={lng}
              active={i18n.language === lng}
              icon={<Check aria-hidden="true" className={cn("size-4", i18n.language !== lng && "invisible")} />}
              onSelect={() => {
                setLanguage(lng);
                close();
              }}
            >
              <span lang={lng}>{t(`languages.${lng}`)}</span>
            </MenuItem>
          ))}
          <div className="mt-2 border-t border-line pt-2">
            {install && (
              <MenuItem
                icon={<Download aria-hidden="true" className="size-4" />}
                onSelect={() => {
                  close();
                  void install();
                }}
              >
                {t("topbar.install")}
              </MenuItem>
            )}
            <MenuItem
              icon={<LogOut aria-hidden="true" className="size-4 rtl:-scale-x-100" />}
              onSelect={() => {
                close();
                void logout(); // the route guard then shows /login
              }}
            >
              {t("topbar.signOut")}
            </MenuItem>
          </div>
        </div>
      )}
    </Menu>
  );
}

/** Search pill, company/branch switcher, notifications, apps grid, account. Sits at the end of the title row. */
export function TopBar() {
  const { t } = useTranslation();
  return (
    <div className="flex w-full items-center gap-2 md:w-auto md:gap-3">
      <GlobalSearch className="hidden w-60 xl:block" />
      <Menu
        align="start"
        className="xl:hidden"
        trigger={(props) => (
          <button type="button" {...props} aria-label={t("topbar.search")} className={cn(circle, "xl:hidden")}>
            <Search aria-hidden="true" className="size-5" strokeWidth={1.75} />
          </button>
        )}
      >
        {(close) => <GlobalSearch autoFocus onDone={close} className="w-72 max-w-[calc(100vw-3rem)] [&_input]:bg-neutral-soft" />}
      </Menu>
      <div className="min-w-0 flex-1 md:flex-none">
        <CompanySwitcher />
      </div>
      <Notifications />
      <AppsMenu />
      <AccountMenu />
    </div>
  );
}
