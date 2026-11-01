import { CalendarPlus, ChevronDown, Clock, ClockAlert, FileText, Home, LogOut, MapPin, MessageSquarePlus, Plane, PlaneTakeoff, Plus, Receipt, Ticket, Timer, UserPen, Wallet } from "lucide-react";
import { createContext, lazy, type ReactNode, Suspense, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { useSession } from "@/auth/session";
import { Button } from "@/design/Button";
import { Menu, MenuItem } from "@/design/Menu";

/** Every request an employee starts from the self-service menu, with the request type (apps/workflow) it creates. */
export type ComposerKind = "leave" | "permission" | "correction" | "overtime" | "remote" | "mission" | "trip" | "ticket" | "exit_reentry" | "letter" | "profile" | "advance" | "advance_change" | "expense" | "general" | "resignation";
export const KIND_OF_TYPE: Record<string, ComposerKind> = {
  "leave.request": "leave",
  "selfservice.permission": "permission",
  "attendance.correction": "correction",
  "attendance.overtime": "overtime",
  "selfservice.remote_work": "remote",
  "selfservice.mission": "mission",
  "selfservice.business_trip": "trip",
  "selfservice.air_ticket": "ticket",
  "compliance.exit_reentry": "exit_reentry",
  "selfservice.letter": "letter",
  "employees.profile_update": "profile",
  "selfservice.expense": "expense",
  "payroll.advance": "advance",
  "payroll.advance_change": "advance_change",
  "selfservice.other": "general",
  "employees.resignation": "resignation",
};
const GROUPS: { key: string; kinds: ComposerKind[] }[] = [
  { key: "time", kinds: ["leave", "permission", "correction", "overtime", "remote"] },
  { key: "travel", kinds: ["mission", "trip", "ticket", "exit_reentry"] },
  { key: "papers", kinds: ["letter", "profile"] },
  { key: "money", kinds: ["advance", "advance_change", "expense"] },
  { key: "other", kinds: ["general", "resignation"] },
];
const ICONS: Record<ComposerKind, ReactNode> = {
  leave: <CalendarPlus className="size-4" />,
  permission: <Clock className="size-4" />,
  correction: <ClockAlert className="size-4" />,
  overtime: <Timer className="size-4" />,
  remote: <Home className="size-4" />,
  mission: <MapPin className="size-4" />,
  trip: <Plane className="size-4" />,
  ticket: <Ticket className="size-4" />,
  exit_reentry: <PlaneTakeoff className="size-4" />,
  letter: <FileText className="size-4" />,
  profile: <UserPen className="size-4" />,
  advance: <Wallet className="size-4" />,
  advance_change: <Wallet className="size-4" />,
  expense: <Receipt className="size-4" />,
  general: <MessageSquarePlus className="size-4" />,
  resignation: <LogOut className="size-4" />,
};
const KINDS = GROUPS.flatMap((g) => g.kinds);

type Open = { kind: ComposerKind; editId?: number };
const Context = createContext<{ open: (kind: ComposerKind, editId?: number) => void; kinds: ComposerKind[] } | null>(null);
const Forms = lazy(() => import("./ComposerForms"));

/** The kinds this user can start: an employee of the active company with selfservice.submit; leave and the
 * attendance correction need their modules. */
function useKinds(): ComposerKind[] {
  const { me, can, hasModule } = useSession();
  if (!me?.employee || !can("selfservice.submit") || !hasModule("self_service")) return [];
  return KINDS.filter(
    (k) => (k !== "leave" || hasModule("leave")) && ((k !== "correction" && k !== "overtime") || hasModule("attendance")) && (!k.startsWith("advance") || hasModule("payroll")) && (k !== "exit_reentry" || hasModule("compliance")),
  );
}

/** Opens any request form from anywhere in the app: `open(kind)`, `open(kind, id)` to correct a returned request,
 * or a link with `?new=<kind>` (the dashboard's quick actions). */
export function ComposerProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Open | null>(null);
  const [params, setParams] = useSearchParams();
  const kinds = useKinds();
  const open = useCallback((kind: ComposerKind, editId?: number) => setCurrent({ kind, editId }), []);
  const asked = params.get("new") as ComposerKind | null;
  useEffect(() => {
    if (!asked) return;
    if (kinds.includes(asked)) setCurrent({ kind: asked });
    if (kinds.length || !KINDS.includes(asked)) {
      const next = new URLSearchParams(params);
      next.delete("new");
      setParams(next, { replace: true });
    }
  }, [asked, kinds, params, setParams]);
  const value = useMemo(() => ({ open, kinds }), [open, kinds]);
  return (
    <Context.Provider value={value}>
      {children}
      {current && (
        <Suspense fallback={null}>
          <Forms kind={current.kind} editId={current.editId} onClose={() => setCurrent(null)} />
        </Suspense>
      )}
    </Context.Provider>
  );
}

export function useComposer() {
  const value = useContext(Context);
  if (!value) throw new Error("useComposer outside ComposerProvider");
  return value;
}

/** "طلب جديد": every request the user can start, grouped. */
export function NewRequestMenu() {
  const { t } = useTranslation();
  const { open, kinds } = useComposer();
  if (!kinds.length) return null;
  return (
    <Menu
      align="end"
      trigger={(props) => (
        <Button {...props} variant="accent" icon={<Plus className="size-[18px]" />}>
          {t("selfService.new")} <ChevronDown aria-hidden="true" className="size-4" />
        </Button>
      )}
    >
      {(close) => (
        <div className="min-w-60 py-1">
          {GROUPS.map((group) => {
            const shown = group.kinds.filter((k) => kinds.includes(k));
            if (!shown.length) return null;
            return (
              <section key={group.key} aria-labelledby={`new-${group.key}`} className="border-line py-1 [&+&]:border-t">
                <h3 id={`new-${group.key}`} className="px-4 pb-1 pt-2 text-xs font-medium text-muted">
                  {t(`selfService.groups.${group.key}`)}
                </h3>
                <ul>
                  {shown.map((kind) => (
                    <li key={kind}>
                      <MenuItem icon={ICONS[kind]} onSelect={() => { close(); open(kind); }}>
                        {t(`selfService.kinds.${kind}`)}
                      </MenuItem>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </Menu>
  );
}
