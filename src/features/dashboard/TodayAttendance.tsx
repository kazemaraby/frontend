import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Coffee, LogIn, LogOut, MapPin, UtensilsCrossed } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { type BreakKind, myDay, type PunchKind, type Today, type Where } from "@/api/attendance";
import { useScopeKey } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card, CardLink } from "@/design/Card";
import { Pill } from "@/design/Pill";
import { hm, useClock } from "@/features/attendance/clock";
import { DAY_TONES } from "@/features/attendance/tones";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

import { CameraDialog, ConsentDialog } from "./SelfieDialogs";

const BREAK_ICONS = { lunch: UtensilsCrossed, short: Coffee } as const;

/** Where the browser says the employee is. Inside a geofence it asks for the precise location (GPS) and waits longer;
 * the server decides (accuracy, radius). No answer = no location. */
function whereAmI(precise: boolean): Promise<Where | null> {
  if (!("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      precise ? { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 } : { timeout: 6000, maximumAge: 60_000 },
    );
  });
}

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

type Kind = Exclude<PunchKind, "unknown">;
type Pending = { kind: Kind; brk?: BreakKind; step: "consent" | "camera" };

/** Today's attendance (Phase 3 tasks 7–8): the shift, check in / out and the shift's breaks (decision 4: breaks are
 * taken only here), on the server's clock. Times are the branch's. A check in / out sends the location (the branch's
 * geofence) and, where the company asks for one, a selfie after a one-time consent. Offline, nothing can be punched.
 * Data: GET /attendance/me/today, POST …/punch, POST / DELETE …/selfie-consent. */
export function TodayAttendance() {
  const { t } = useTranslation();
  const format = useFormat();
  const clock = useClock();
  const scope = useScopeKey();
  const online = useOnline();
  const queryClient = useQueryClient();
  const key = ["attendance-today", ...scope];
  const day = useQuery({ queryKey: key, queryFn: myDay.today, refetchInterval: 60_000, retry: false });
  const [pending, setPending] = useState<Pending | null>(null);
  const d = day.data;
  const punch = useMutation({
    mutationFn: async ({ kind, brk, selfie }: { kind: Kind; brk?: BreakKind; selfie?: Blob }) => {
      const checked = kind === "in" || kind === "out";
      const precise = checked && Boolean(d?.checks.geofence) && !d?.checks.excused_by;
      return myDay.punch(kind, brk, await whereAmI(precise), selfie);
    },
    onSuccess: (data) => {
      setPending(null);
      queryClient.setQueryData(key, data);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["attendance-days"] }),
  });
  const consent = useMutation({
    mutationFn: myDay.consent,
    onSuccess: (data) => {
      queryClient.setQueryData(key, data);
      setPending((p) => (p ? { ...p, step: "camera" } : null));
    },
  });
  const withdraw = useMutation({ mutationFn: myDay.withdraw, onSuccess: () => queryClient.invalidateQueries({ queryKey: key }) });
  const start = (kind: Kind, brk?: BreakKind) => {
    punch.reset();
    if ((kind === "in" || kind === "out") && d?.checks.selfie_required) setPending({ kind, brk, step: d.checks.selfie_consent ? "camera" : "consent" });
    else punch.mutate({ kind, brk });
  };
  const errors = apiErrors(punch.error ?? consent.error ?? withdraw.error, t("common.saveFailed"));
  const problem = errors.fields.location ?? errors.fields.selfie ?? errors.fields.kind ?? errors.general;
  const time = (iso: string | null) => (d ? clock(iso, d.time_zone) : "—");
  const busy = punch.isPending || !online;

  return (
    <Card title={t("dashboard.todaysAttendance")} subtitle={d ? <ShiftLine day={d} time={time} /> : undefined}>
      {day.isError && <p className="text-sm text-muted">{t("myDay.unavailable")}</p>}
      {d && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {!d.off && (
              <Pill tone={DAY_TONES[d.status]}>
                {d.covers[0] && ["leave", "mission", "trip", "remote"].includes(d.status)
                  ? format.pick(d.covers[0].label)
                  : t(`record.status.${d.status}`)}
              </Pill>
            )}
            {d.on_break && <Pill tone="amber">{t("myDay.onBreak", { name: t(`shifts.breakKinds.${d.on_break}`) })}</Pill>}
            {d.worked_minutes > 0 && (
              <span className="text-sm text-muted">
                {t("myDay.worked")} <span className="num font-semibold text-ink">{hm(d.worked_minutes)}</span>
              </span>
            )}
          </div>

          {(d.actions.includes("in") || d.actions.includes("out")) && (
            <div className="grid grid-cols-1">
              {d.actions.includes("in") ? (
                <Button icon={<LogIn className="size-5" />} disabled={busy} onClick={() => start("in")}>
                  {t("myDay.checkIn")}
                </Button>
              ) : (
                <Button icon={<LogOut className="size-5" />} disabled={busy} onClick={() => start("out")}>
                  {t("myDay.checkOut")}
                </Button>
              )}
            </div>
          )}

          {d.breaks.length > 0 && (
            <ul aria-label={t("myDay.breaks")} className="flex flex-col gap-2">
              {d.breaks.map((b, i) => {
                const Icon = BREAK_ICONS[b.kind];
                const name = t(`shifts.breakKinds.${b.kind}`);
                const canStart = d.actions.includes(`break_start:${b.kind}`) && d.breaks.findIndex((x) => x.kind === b.kind) === i;
                const canEnd = d.on_break === b.kind && d.breaks.findIndex((x) => x.kind === b.kind) === i;
                return (
                  <li key={i} className="flex items-center gap-3 rounded-card bg-white p-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal-soft text-teal-dark">
                      <Icon aria-hidden="true" className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-ink">{name}</span>
                      <span className="block text-xs text-muted">
                        {t("myDay.breakWindow", { from: time(b.from), to: time(b.to), minutes: b.minutes })}
                      </span>
                    </span>
                    {canStart && (
                      <Button size="sm" variant="accent" aria-label={t("myDay.startBreak", { name })} disabled={busy} onClick={() => start("break_start", b.kind)}>
                        {t("dashboard.start")}
                      </Button>
                    )}
                    {canEnd && (
                      <Button size="sm" aria-label={t("myDay.endBreak", { name })} disabled={busy} onClick={() => start("break_end")}>
                        {t("dashboard.end")}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {d.punches.length > 0 && (
            <ol aria-label={t("myDay.punches")} className="flex flex-col gap-1 text-sm">
              {d.punches.map((p, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <span className="text-muted">
                    {t(`devices.punchKinds.${p.kind}`)}
                    {p.break && ` · ${t(`shifts.breakKinds.${p.break}`)}`}
                  </span>
                  <span dir="ltr" className="num font-medium text-ink">
                    {time(p.time)}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {!online && <Alert tone="warning">{t("myDay.offline")}</Alert>}
          {problem && <Alert>{problem}</Alert>}
          <ChecksNote day={d} busy={withdraw.isPending} onWithdraw={() => withdraw.mutate()} />
        </div>
      )}
      {d && pending?.step === "consent" && <ConsentDialog keepDays={d.checks.selfie_keep_days} busy={consent.isPending} onAgree={() => consent.mutate()} onClose={() => setPending(null)} />}
      {pending?.step === "camera" && (
        <CameraDialog
          title={t(pending.kind === "in" ? "myDay.checkIn" : "myDay.checkOut")}
          busy={punch.isPending}
          onUse={(selfie) => punch.mutate({ kind: pending.kind, brk: pending.brk, selfie })}
          onClose={() => setPending(null)}
        />
      )}
    </Card>
  );
}

function ShiftLine({ day, time }: { day: Today; time: (iso: string | null) => string }) {
  const { t } = useTranslation();
  const format = useFormat();
  if (day.off) return <>{t("myDay.off")}</>;
  if (!day.shift) return <>{t("myDay.noShift")}</>;
  return (
    <>
      {format.name(day.shift)}{" "}
      {day.flexible ? (
        t("myDay.flexible", { hours: hm(day.scheduled_minutes), latest: time(day.latest_start) })
      ) : (
        <span dir="ltr" className="num">
          {day.parts.map((p) => `${time(p.from)}–${time(p.to)}`).join(" · ")}
        </span>
      )}
    </>
  );
}

/** What a check in / out needs today: the branch's location check (or why it is lifted) and the selfie, with a way to
 * withdraw the consent. */
function ChecksNote({ day, busy, onWithdraw }: { day: Today; busy: boolean; onWithdraw: () => void }) {
  const { t } = useTranslation();
  const c = day.checks;
  if (!c.geofence && !c.selfie_required) return null;
  return (
    <ul className="flex flex-col gap-1 text-xs text-muted">
      {c.geofence && (
        <li className="flex items-center gap-1.5">
          <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
          {c.excused_by ? t(`myDay.excused.${c.excused_by}`) : t("myDay.geofence", { metres: c.radius_m })}
        </li>
      )}
      {c.selfie_required && (
        <li className="flex flex-wrap items-center gap-1.5">
          <Camera aria-hidden="true" className="size-3.5 shrink-0" />
          {t(c.selfie_consent ? "myDay.selfieOn" : "myDay.selfieAsk")}
          {c.selfie_consent && (
            <CardLink className="text-xs" disabled={busy} onClick={onWithdraw}>
              {t("myDay.withdraw")}
            </CardLink>
          )}
        </li>
      )}
    </ul>
  );
}
