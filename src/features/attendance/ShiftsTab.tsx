import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Moon, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { RULES, type RuleField, type Segment, type Shift, type ShiftBreak, type ShiftColor, type ShiftInput, type ShiftKind, type ShiftPlan, shifts, type ShiftSummary, type Variant } from "@/api/attendance";
import { useScopeKey } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { Dialog } from "@/design/Dialog";
import { CheckField, FormSelect, TextField } from "@/design/Field";
import { Pill } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

import { hm } from "./clock";

const KINDS: ShiftKind[] = ["fixed", "night", "split", "flexible"];
const COLORS: ShiftColor[] = ["teal", "sky", "lavender", "amber", "orange", "pink", "green", "navy"];
/** The shift's colour as a solid dot (the roster uses the same colours). */
export const DOTS: Record<ShiftColor, string> = {
  teal: "bg-teal-dark",
  sky: "bg-sky-500",
  lavender: "bg-violet-400",
  amber: "bg-amber-400",
  orange: "bg-orange-500",
  pink: "bg-pink-400",
  green: "bg-green-600",
  navy: "bg-navy",
};

/** "07:30" for 450 minutes. */

function useTimeText() {
  const { t } = useTranslation();
  const format = useFormat();
  // "06:00+1" (the next day) from a plan
  return (value: string) => {
    const [time, day] = value.split("+");
    return day ? t("shifts.nextDay", { time: format.time(time) }) : format.time(time);
  };
}

function PlanText({ plan }: { plan: ShiftPlan }) {
  const { t } = useTranslation();
  const time = useTimeText();
  if (plan.flexible) return <span className="num">{t("shifts.flexibleHours", { hours: hm(plan.scheduled_minutes) })}</span>;
  return (
    <span className="num">
      {plan.segments.map((s) => `${time(s.start)} – ${time(s.end)}`).join(" · ")} <span className="text-muted">({t("shifts.workHours", { hours: hm(plan.scheduled_minutes) })})</span>
    </span>
  );
}

/** The company's shifts (Phase 3 task 2): times, Ramadan times, breaks and rules. A shift's working hours always come
 * from its times; the Labor Law's limits are checked as it is edited. */
export function ShiftsTab() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const list = useQuery({ queryKey: ["shifts", ...scope], queryFn: () => shifts.list() });
  const [editing, setEditing] = useState<Shift | "new" | null>(null);
  return (
    <Card
      variant="solid"
      title={t("shifts.title")}
      subtitle={t("shifts.hint")}
      action={
        <Button size="sm" variant="accent" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
          {t("shifts.add")}
        </Button>
      }
    >
      {list.isSuccess && list.data.length === 0 ? (
        <p className="text-sm text-muted">{t("shifts.none")}</p>
      ) : (
        <ul aria-label={t("shifts.title")} className="flex flex-col divide-y divide-line">
          {(list.data ?? []).map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
              <span aria-hidden="true" className={`size-3 shrink-0 rounded-full ${DOTS[s.color]}`} />
              <span className="flex min-w-44 flex-col">
                <span className="font-semibold text-ink">{format.name(s)}</span>
                <span className="flex items-center gap-2 text-sm text-muted">
                  <span>{t(`shifts.kinds.${s.kind}`)}</span>
                  {s.code && (
                    <span className="num rounded bg-neutral-soft px-1.5 text-xs" dir="ltr">
                      {s.code}
                    </span>
                  )}
                </span>
              </span>
              <span className="flex min-w-64 flex-col gap-0.5 text-sm">
                {s.plans.normal && <PlanText plan={s.plans.normal} />}
                {s.plans.ramadan ? (
                  <span className="flex items-center gap-1.5 text-muted">
                    <Moon aria-hidden="true" className="size-3.5" />
                    <PlanText plan={s.plans.ramadan} />
                  </span>
                ) : (
                  <span className="text-muted">{t("shifts.noRamadan")}</span>
                )}
              </span>
              {s.warnings.length > 0 && <Pill tone="amber">{t("shifts.needsRamadan")}</Pill>}
              {!s.is_active && <Pill tone="navy">{t("leaveSettings.off")}</Pill>}
              <IconButton className="ms-auto" size="sm" variant="plain" label={t("common.editNamed", { name: format.name(s) })} icon={<Pencil />} onClick={() => setEditing(s)} />
            </li>
          ))}
        </ul>
      )}
      {editing && <ShiftDialog shift={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

type Draft = Omit<ShiftInput, RuleField> & { rules: Record<RuleField, string> };

const blankSegment = (variant: Variant, order = 1): Segment => ({ variant, order, start_time: "", end_time: "" });

function draftOf(shift?: Shift): Draft {
  return {
    code: shift?.code ?? "",
    name_ar: shift?.name_ar ?? "",
    name_en: shift?.name_en ?? "",
    kind: shift?.kind ?? "fixed",
    color: shift?.color ?? "teal",
    is_active: shift?.is_active ?? true,
    flex_earliest_start: shift?.flex_earliest_start ?? null,
    flex_latest_start: shift?.flex_latest_start ?? null,
    required_minutes: shift?.required_minutes ?? null,
    ramadan_required_minutes: shift?.ramadan_required_minutes ?? null,
    segments: shift?.segments ?? [blankSegment("normal")],
    breaks: shift?.breaks ?? [],
    rules: Object.fromEntries(RULES.map((r) => [r, shift?.[r] === null || shift?.[r] === undefined ? "" : String(shift[r])])) as Record<RuleField, string>,
  };
}

/** What the API takes: rules left empty inherit the attendance settings; incomplete rows are left out. */
function bodyOf(d: Draft): Partial<ShiftInput> {
  const flexible = d.kind === "flexible";
  return {
    code: d.code,
    name_ar: d.name_ar,
    name_en: d.name_en,
    kind: d.kind,
    color: d.color,
    is_active: d.is_active,
    flex_earliest_start: flexible ? d.flex_earliest_start || null : null,
    flex_latest_start: flexible ? d.flex_latest_start || null : null,
    required_minutes: flexible ? d.required_minutes : null,
    ramadan_required_minutes: flexible ? d.ramadan_required_minutes : null,
    segments: flexible ? [] : d.segments.filter((s) => s.start_time && s.end_time),
    breaks: d.breaks.filter((b) => b.start_time && b.end_time && b.minutes),
    ...(Object.fromEntries(RULES.map((r) => [r, d.rules[r] === "" ? null : r === "rounding_direction" ? d.rules[r] : Number(d.rules[r])])) as Partial<ShiftInput>),
  };
}

function ShiftDialog({ shift, onClose }: { shift?: Shift; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const scope = useScopeKey();
  const [d, setD] = useState<Draft>(() => draftOf(shift));
  const [ramadanOwn, setRamadanOwn] = useState(Boolean(shift?.segments.some((s) => s.variant === "ramadan") || shift?.ramadan_required_minutes));
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const company = useQuery({ queryKey: ["attendance-settings", ...scope], queryFn: shifts.settings });
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((x) => ({ ...x, [key]: value }));
  const flexible = d.kind === "flexible";
  const parts = (variant: Variant) => d.segments.filter((s) => s.variant === variant);
  const body = () => {
    const b = bodyOf(d);
    if (!ramadanOwn) return { ...b, segments: (b.segments ?? []).filter((s) => s.variant === "normal"), ramadan_required_minutes: null, breaks: (b.breaks ?? []).filter((x) => x.applies_to !== "ramadan") };
    return b;
  };

  // Keep the normal parts in step with the kind (one, or two for a split shift).
  const setKind = (kind: ShiftKind) => {
    const normal = parts("normal");
    const wanted = kind === "split" ? 2 : kind === "flexible" ? 0 : 1;
    const next = [...normal.slice(0, wanted), ...Array.from({ length: Math.max(0, wanted - normal.length) }, (_, i) => blankSegment("normal", normal.length + i + 1))];
    setD((x) => ({ ...x, kind, segments: [...next, ...x.segments.filter((s) => s.variant === "ramadan")] }));
  };

  // Live check against the Labor Law as the times change (nothing is saved).
  const payload = JSON.stringify(body());
  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(() => {
      shifts.preview(JSON.parse(payload)).then((s) => live && setSummary(s)).catch(() => live && setSummary(null));
    }, 300);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [payload]);

  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: ["shifts"] });
    onClose();
  };
  const save = useMutation({ mutationFn: () => shifts.save(body(), shift?.id), onSuccess: done });
  const remove = useMutation({ mutationFn: () => shifts.remove(shift!.id), onSuccess: done });
  const errors = apiErrors(save.error ?? remove.error, t("common.saveFailed"));
  const problem = (field: string) => errors.fields[field] ?? summary?.errors[field]?.[0];

  const setSegment = (variant: Variant, index: number, patch: Partial<Segment>) =>
    setD((x) => {
      let seen = -1;
      return { ...x, segments: x.segments.map((s) => (s.variant === variant && ++seen === index ? { ...s, ...patch } : s)) };
    });
  const segmentRows = (variant: Variant) =>
    parts(variant).map((s, i) => (
      <div key={`${variant}-${i}`} className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
        <TextField label={t("shifts.from", { part: i + 1 })} name={`${variant}_start_${i}`} type="time" dir="ltr" value={s.start_time} onChange={(e) => setSegment(variant, i, { start_time: e.target.value })} />
        <TextField label={t("shifts.to", { part: i + 1 })} name={`${variant}_end_${i}`} type="time" dir="ltr" value={s.end_time} onChange={(e) => setSegment(variant, i, { end_time: e.target.value })} />
        {variant === "ramadan" && parts("ramadan").length > 1 ? (
          <IconButton size="sm" variant="plain" label={t("shifts.removePart")} icon={<Trash2 />} onClick={() => setD((x) => ({ ...x, segments: x.segments.filter((y) => !(y.variant === "ramadan" && y.order === s.order)) }))} />
        ) : (
          <span className="size-9" />
        )}
      </div>
    ));
  const hoursInput = (name: "required_minutes" | "ramadan_required_minutes", label: string) => (
    <TextField label={label} name={name} inputMode="decimal" dir="ltr" value={d[name] === null ? "" : String(d[name]! / 60)} onChange={(e) => set(name, e.target.value.trim() === "" ? null : Math.round(Number(e.target.value) * 60))} hint={t("shifts.inHours")} error={problem(name)} />
  );
  const setBreak = (index: number, patch: Partial<ShiftBreak>) => set("breaks", d.breaks.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  const normal = summary?.plans.normal;
  const ramadan = summary?.plans.ramadan;

  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={shift ? t("shifts.edit") : t("shifts.add")}
      footer={
        <>
          {shift && (
            <Button variant="outline" className="me-auto" disabled={remove.isPending} onClick={() => remove.mutate()}>
              {t("common.delete")}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!d.name_ar.trim() || save.isPending || Boolean(summary && Object.keys(summary.errors).length)} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("letters.nameAr")} name="name_ar" value={d.name_ar} onChange={(e) => set("name_ar", e.target.value)} error={errors.fields.name_ar} required />
          <TextField label={t("letters.nameEn")} name="name_en" dir="ltr" value={d.name_en} onChange={(e) => set("name_en", e.target.value)} />
          <FormSelect label={t("shifts.kind")} name="kind" value={d.kind} onChange={(e) => setKind(e.target.value as ShiftKind)} options={KINDS.map((k) => ({ value: k, label: t(`shifts.kinds.${k}`) }))} error={problem("kind")} />
          <TextField label={t("shifts.code")} name="code" dir="ltr" value={d.code} onChange={(e) => set("code", e.target.value)} error={errors.fields.code} />
          <FormSelect label={t("shifts.color")} name="color" value={d.color} onChange={(e) => set("color", e.target.value as ShiftColor)} options={COLORS.map((c) => ({ value: c, label: t(`shifts.colors.${c}`) }))} />
          <CheckField className="self-end pb-3" label={t("leaveSettings.active")} checked={d.is_active} onChange={(e) => set("is_active", e.target.checked)} />
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 font-semibold text-ink">{t("shifts.normalTimes")}</legend>
          {flexible ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField label={t("shifts.earliest")} name="flex_earliest_start" type="time" dir="ltr" value={d.flex_earliest_start ?? ""} onChange={(e) => set("flex_earliest_start", e.target.value || null)} />
              <TextField label={t("shifts.latest")} name="flex_latest_start" type="time" dir="ltr" value={d.flex_latest_start ?? ""} onChange={(e) => set("flex_latest_start", e.target.value || null)} error={problem("flex_latest_start")} />
              {hoursInput("required_minutes", t("shifts.required"))}
            </div>
          ) : (
            segmentRows("normal")
          )}
          {problem("segments") && <p className="text-sm text-danger">{problem("segments")}</p>}
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 font-semibold text-ink">{t("shifts.ramadanTimes")}</legend>
          <CheckField
            label={t("shifts.ramadanOwn")}
            checked={ramadanOwn}
            onChange={(e) => {
              setRamadanOwn(e.target.checked);
              if (e.target.checked && !flexible && !parts("ramadan").length) set("segments", [...d.segments, blankSegment("ramadan")]);
            }}
          />
          {ramadanOwn &&
            (flexible ? (
              <div className="grid gap-4 sm:grid-cols-3">{hoursInput("ramadan_required_minutes", t("shifts.required"))}</div>
            ) : (
              <>
                {segmentRows("ramadan")}
                {parts("ramadan").length < 2 && (
                  <Button size="sm" variant="ghost" className="self-start" icon={<Plus className="size-4" />} iconPosition="start" onClick={() => set("segments", [...d.segments, blankSegment("ramadan", 2)])}>
                    {t("shifts.addPart")}
                  </Button>
                )}
              </>
            ))}
          {problem("ramadan_segments") && <p className="text-sm text-danger">{problem("ramadan_segments")}</p>}
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 font-semibold text-ink">{t("shifts.breaks")}</legend>
          <p className="text-sm text-muted">{t("shifts.breaksHint")}</p>
          {d.breaks.map((b, i) => (
            <div key={i} className="grid grid-cols-2 items-end gap-3 rounded-card border border-line p-3 sm:grid-cols-[1fr_1fr_1fr_1fr_6rem_auto]">
              <FormSelect label={t("shifts.breakKind")} name={`break_kind_${i}`} value={b.kind} onChange={(e) => setBreak(i, { kind: e.target.value as ShiftBreak["kind"] })} options={(["lunch", "short"] as const).map((k) => ({ value: k, label: t(`shifts.breakKinds.${k}`) }))} />
              <FormSelect label={t("shifts.breakApplies")} name={`break_applies_${i}`} value={b.applies_to} onChange={(e) => setBreak(i, { applies_to: e.target.value as ShiftBreak["applies_to"] })} options={(["both", "normal", "ramadan"] as const).map((k) => ({ value: k, label: t(`shifts.breakApply.${k}`) }))} />
              <TextField label={t("shifts.windowFrom")} name={`break_start_${i}`} type="time" dir="ltr" value={b.start_time} onChange={(e) => setBreak(i, { start_time: e.target.value })} />
              <TextField label={t("shifts.windowTo")} name={`break_end_${i}`} type="time" dir="ltr" value={b.end_time} onChange={(e) => setBreak(i, { end_time: e.target.value })} />
              <TextField label={t("shifts.minutes")} name={`break_minutes_${i}`} inputMode="numeric" dir="ltr" value={b.minutes ? String(b.minutes) : ""} onChange={(e) => setBreak(i, { minutes: Number(e.target.value) || 0 })} />
              <IconButton size="sm" variant="plain" label={t("shifts.removeBreak")} icon={<Trash2 />} onClick={() => set("breaks", d.breaks.filter((_, j) => j !== i))} />
              <CheckField className="col-span-2 sm:col-span-6" label={t("shifts.paid")} checked={b.paid} onChange={(e) => setBreak(i, { paid: e.target.checked })} />
            </div>
          ))}
          <Button size="sm" variant="ghost" className="self-start" icon={<Plus className="size-4" />} iconPosition="start" onClick={() => set("breaks", [...d.breaks, { kind: "lunch", applies_to: "both", start_time: "", end_time: "", minutes: 30, paid: false }])}>
            {t("shifts.addBreak")}
          </Button>
          {problem("breaks") && <p className="text-sm text-danger">{problem("breaks")}</p>}
        </fieldset>

        <details className="rounded-card border border-line p-4">
          <summary className="cursor-pointer font-semibold text-ink">{t("shifts.rules")}</summary>
          <p className="mt-2 text-sm text-muted">{t("shifts.rulesHint")}</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {RULES.map((r) =>
              r === "rounding_direction" ? (
                <FormSelect key={r} label={t(`attendanceSettings.rules.fields.${r}`)} name={r} value={d.rules[r]} placeholder={company.data ? t(`attendanceSettings.rules.directions.${company.data.effective[r]}`) : "—"} onChange={(e) => set("rules", { ...d.rules, [r]: e.target.value })} options={(["nearest", "up", "down"] as const).map((x) => ({ value: x, label: t(`attendanceSettings.rules.directions.${x}`) }))} />
              ) : (
                <TextField key={r} label={t(`attendanceSettings.rules.fields.${r}`)} name={r} inputMode="numeric" dir="ltr" placeholder={company.data ? String(company.data.effective[r]) : ""} value={d.rules[r]} onChange={(e) => set("rules", { ...d.rules, [r]: e.target.value })} error={errors.fields[r]} />
              ),
            )}
          </div>
        </details>

        {summary && (normal || ramadan) && Object.keys(summary.errors).length === 0 && (
          <div role="status" aria-label={t("shifts.summary")} className="flex flex-col gap-1 rounded-card bg-teal-soft px-4 py-3 text-sm text-teal-ink">
            {normal && (
              <span>
                {t("shifts.normalTimes")}: <PlanText plan={normal} />
              </span>
            )}
            {ramadan && (
              <span>
                {t("shifts.ramadanTimes")}: <PlanText plan={ramadan} />
              </span>
            )}
          </div>
        )}
        {(summary?.warnings ?? []).map((w) => (
          <Alert key={w} tone="warning">
            {w}
          </Alert>
        ))}
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
