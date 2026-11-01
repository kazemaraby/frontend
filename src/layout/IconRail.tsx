import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";

import { useSession } from "@/auth/session";
import { cn } from "@/design/cn";
import { Tooltip } from "@/design/Tooltip";

import { Logo } from "./Logo";
import { FOOTER_NAV, MAIN_NAV, type NavItem } from "./nav";

function RailLink({ item, compact }: { item: NavItem; compact?: boolean }) {
  const { t } = useTranslation();
  const label = t(`nav.${item.id}`);
  const link = (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      aria-label={label}
      className={({ isActive }) =>
        cn(
          "flex shrink-0 items-center justify-center rounded-full transition-colors",
          compact ? "size-11" : "size-12",
          isActive ? "bg-navy text-white" : "text-ink hover:bg-white/70",
        )
      }
    >
      <item.icon className="size-[22px]" strokeWidth={1.75} aria-hidden="true" />
    </NavLink>
  );
  return compact ? link : <Tooltip label={label} side="start">{link}</Tooltip>;
}

/** Vertical rail on the start side (right in Arabic); a scrollable bottom bar on phones.
 * `preview` renders only the vertical rail, inline (for /dev/components). */
export function IconRail({ preview = false }: { preview?: boolean }) {
  const { t } = useTranslation();
  const { can, hasModule } = useSession();
  const visible = (item: NavItem) => hasModule(item.module) && can(item.permission);
  const main = MAIN_NAV.filter(visible);
  const footer = FOOTER_NAV.filter(visible);
  return (
    <>
      <nav
        aria-label={t("nav.label")}
        className={cn(
          "w-[88px] shrink-0 flex-col items-center",
          preview ? "flex py-2" : "sticky top-0 hidden h-dvh py-6 lg:flex",
        )}
      >
        <Logo className="mb-8" />
        <ul className="flex flex-col items-center gap-2">
          {main.map((item) => (
            <li key={item.id}>
              <RailLink item={item} />
            </li>
          ))}
        </ul>
        <div aria-hidden="true" className="my-5 h-px w-11 bg-line-strong" />
        <ul className="flex flex-col items-center gap-2">
          {footer.map((item) => (
            <li key={item.id}>
              <RailLink item={item} />
            </li>
          ))}
        </ul>
      </nav>

      {!preview && (
      <nav
        aria-label={t("nav.label")}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/80 bg-white/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <ul className="scrollbar-none flex items-center gap-1 overflow-x-auto px-3 py-2">
          {[...main, ...footer].map((item) => (
            <li key={item.id}>
              <RailLink item={item} compact />
            </li>
          ))}
        </ul>
      </nav>
      )}
    </>
  );
}
