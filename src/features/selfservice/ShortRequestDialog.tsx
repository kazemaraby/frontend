import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "@/api";
import { hr } from "@/api/hr";
import { type Payload, type Preview, selfService, type ShortKind, type TicketBalance, type Usage } from "@/api/selfservice";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { DateInput } from "@/design/DateInput";
import { Dialog } from "@/design/Dialog";
import { CheckField, FormSelect, TextArea, TextField } from "@/design/Field";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

export type Kind = "permission" | "mission" | "remote" | "trip" | "ticket";
export const PATHS: Record<Kind, string> = {
  permission: "/permission-requests",
  mission: "/mission-requests",
  remote: "/remote-work-requests",
  trip: "/trip-requests",
  ticket: "/ticket-requests",
};

// --- the forms ------------------------------------------------------------------------------

type Values = Record<string, string | boolean>;
const INITIAL: Record<Kind, Values> = {
  permission: { kind: "late_arrival", date: "", from_time: "", to_time: "", reason: "" },
  mission: { start_date: "", end_date: "", whole_day: true, from_time: "", to_time: "", location: "", purpose: "" },
  remote: { start_date: "", end_date: "", reason: "" },
  trip: { country: "", city: "", start_date: "", end_date: "", purpose: "", transport: "air", advance: "" },
  ticket: { travel_date: "", return_date: "", from_city: "", to_city: "", country: "", take_cash: false, reason: "" },
};

function body(kind: Kind, v: Values, family: number[] = []): Payload {
  if (kind === "trip")
    return {
      country: String(v.country),
      city: String(v.city),
      start_date: String(v.start_date),
      end_date: String(v.end_date),
      purpose: String(v.purpose),
      transport: String(v.transport),
      advance: String(v.advance).trim() || "0",
    };
  if (kind === "ticket")
    return {
      travel_date: String(v.travel_date),
      return_date: String(v.return_date) || null,
      from_city: String(v.from_city),
      to_city: String(v.to_city),
      country: String(v.country) || null,
      take_cash: Boolean(v.take_cash),
      family,
      reason: String(v.reason),
    };
  if (kind === "permission") return { kind: String(v.kind), date: String(v.date), from_time: String(v.from_time), to_time: String(v.to_time), reason: String(v.reason) };
  if (kind === "mission")
    return {
      start_date: String(v.start_date),
      end_date: String(v.end_date),
      from_time: v.whole_day ? null : String(v.from_time) || null,
      to_time: v.whole_day ? null : String(v.to_time) || null,
      location: String(v.location),
      purpose: String(v.purpose),
    };
  return { start_date: String(v.start_date), end_date: String(v.end_date), reason: String(v.reason) };
}

function ready(kind: Kind, v: Values) {
  if (kind === "trip") return Boolean(v.country && String(v.city).trim() && v.start_date && v.end_date && String(v.purpose).trim());
  if (kind === "ticket") return Boolean(v.travel_date && String(v.from_city).trim() && String(v.to_city).trim());
  if (kind === "permission") return Boolean(v.date && v.from_time && v.to_time);
  if (kind === "mission") return Boolean(v.start_date && v.end_date && String(v.location).trim() && String(v.purpose).trim());
  return Boolean(v.start_date && v.end_date);
}

type Stored = Record<string, unknown> & { family?: number[] };

/** The values of a stored request, as the form holds them (times without seconds, empty for none). */
function valuesOf(kind: Kind, row: Stored): Values {
  const out: Values = { ...INITIAL[kind] };
  for (const key of Object.keys(out)) {
    const raw = row[key];
    if (typeof out[key] === "boolean") out[key] = Boolean(raw);
    else out[key] = raw === null || raw === undefined ? "" : key.endsWith("_time") ? String(raw).slice(0, 5) : String(raw);
  }
  if (kind === "mission") out.whole_day = !row.from_time && !row.to_time;
  return out;
}

/** The form of a short permission, mission, remote work, business trip or air ticket. With `editId` it loads that
 * returned request, saves the changes and sends it again. */
export function ShortRequestDialog({ kind, editId, onClose }: { kind: Kind; editId?: number; onClose: () => void }) {
  const { t } = useTranslation();
  const scope = useScopeKey();
  const { me } = useSession();
  const month = new Date().toLocaleDateString("en-CA").slice(0, 7);
  const usage = useQuery({ queryKey: ["selfservice", "usage", month, ...scope], queryFn: () => selfService.usage(month), retry: false, enabled: Boolean(me?.employee) && kind === "permission" });
  const tickets = useQuery({ queryKey: ["selfservice", "tickets", ...scope], queryFn: () => selfService.ticketBalance(), retry: false, enabled: Boolean(me?.employee) && kind === "ticket" });
  const stored = useQuery({ queryKey: ["selfservice", kind, "edit", editId], queryFn: () => api.get<Stored>(`${PATHS[kind]}/${editId}`), enabled: Boolean(editId) });
  if (editId && !stored.data) {
    return (
      <Dialog open onClose={onClose} title={t("approvals.editAndResubmit")}>
        {stored.isError ? <Alert>{apiErrors(stored.error, t("common.loadFailed")).general}</Alert> : <p className="text-muted">{t("common.loading")}</p>}
      </Dialog>
    );
  }
  return (
    <RequestForm
      kind={kind}
      editId={editId}
      initial={stored.data ? valuesOf(kind, stored.data) : INITIAL[kind]}
      initialFamily={stored.data?.family ?? []}
      usage={usage.data}
      tickets={tickets.data}
      onClose={onClose}
    />
  );
}

function RequestForm({ kind, editId, initial, initialFamily, usage, tickets, onClose }: { kind: Kind; editId?: number; initial: Values; initialFamily: number[]; usage?: Usage; tickets?: TicketBalance; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const [v, setV] = useState<Values>(initial);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [family, setFamily] = useState<number[]>(initialFamily);
  const countries = useQuery({ queryKey: ["reference", "countries"], queryFn: hr.countries, staleTime: 86_400_000, enabled: kind === "trip" || kind === "ticket" });
  const set = (key: string, value: string | boolean) => setV((x) => ({ ...x, [key]: value }));
  const filled = ready(kind, v);

  useEffect(() => {
    if (!filled) return setPreview(null);
    let live = true;
    const timer = window.setTimeout(() => {
      selfService
        .preview(kind, body(kind, v, family), editId)
        .then((p) => live && setPreview(p))
        .catch(() => live && setPreview(null));
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [kind, v, family, filled, editId]);

  const save = useMutation({
    mutationFn: async () => {
      if (!editId) return selfService.create(kind, body(kind, v, family));
      await api.patch(`${PATHS[kind]}/${editId}`, body(kind, v, family));
      return api.post(`${PATHS[kind]}/${editId}/submit`, {});
    },
    onSuccess: async () => {
      await Promise.all(["requests", "selfservice", "approvals"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const first = (field: string) => errors.fields[field] ?? preview?.errors[field]?.[0];
  const countryOptions = (countries.data ?? []).map((c) => ({ value: c.code, label: format.name(c) }));
  const previewText = (k: Kind, p: Preview) => {
    const n = (x: string | number | null | undefined) => format.number(Number(x ?? 0), [0, 2]);
    if (k === "permission") return t("selfService.counted.hours", { value: n(p.hours) });
    if (k === "trip")
      return p.daily_rate
        ? t("selfService.trip.perDiem", { days: n(p.days), rate: n(p.daily_rate), total: n(p.per_diem_total) })
        : t("selfService.trip.noRate", { days: n(p.days) });
    if (k === "ticket") return "";
    return t("selfService.counted.days", { value: n(p.days) });
  };
  const time = (name: string, label: string) => (
    <TextField label={label} name={name} type="time" dir="ltr" value={String(v[name])} onChange={(e) => set(name, e.target.value)} error={first(name)} required />
  );

  return (
    <Dialog
      open
      onClose={onClose}
      title={editId ? `${t("approvals.editAndResubmit")} · ${t(`selfService.kinds.${kind}`)}` : t(`selfService.kinds.${kind}`)}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="accent" disabled={!filled || save.isPending} onClick={() => save.mutate()}>
            {t("approvals.send")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {kind === "permission" && (
          <>
            <FormSelect
              label={t("selfService.permission.kind")}
              name="kind"
              value={String(v.kind)}
              onChange={(e) => set("kind", e.target.value as ShortKind)}
              options={(["late_arrival", "early_leave", "during_day"] as const).map((k) => ({ value: k, label: t(`selfService.permission.kinds.${k}`) }))}
            />
            <DateInput label={t("selfService.date")} name="date" value={String(v.date) || null} onChange={(d) => set("date", d ?? "")} error={first("date") ?? first("start_date")} required />
            <div className="grid gap-4 sm:grid-cols-2">
              {time("from_time", t("selfService.fromTime"))}
              {time("to_time", t("selfService.toTime"))}
            </div>
            {usage && <p className="num text-sm text-muted">{t("selfService.permission.limits", { max: format.number(Number(usage.permission_max_hours), [0, 2]), used: usage.permissions.used, limit: usage.permissions.limit })}</p>}
          </>
        )}
        {(kind === "mission" || kind === "remote" || kind === "trip") && (
          <div className="grid gap-4 sm:grid-cols-2">
            <DateInput label={t("leave.from")} name="start_date" value={String(v.start_date) || null} onChange={(d) => set("start_date", d ?? "")} error={first("start_date")} required />
            <DateInput label={t("leave.to")} name="end_date" value={String(v.end_date) || null} min={String(v.start_date) || undefined} onChange={(d) => set("end_date", d ?? "")} error={first("end_date")} required />
          </div>
        )}
        {kind === "mission" && (
          <>
            <TextField label={t("selfService.mission.location")} name="location" value={String(v.location)} onChange={(e) => set("location", e.target.value)} error={first("location")} required />
            <TextArea label={t("selfService.mission.purpose")} name="purpose" rows={2} value={String(v.purpose)} onChange={(e) => set("purpose", e.target.value)} error={first("purpose")} required />
            <CheckField label={t("selfService.mission.wholeDay")} checked={Boolean(v.whole_day)} onChange={(e) => set("whole_day", e.target.checked)} />
            {!v.whole_day && (
              <div className="grid gap-4 sm:grid-cols-2">
                {time("from_time", t("selfService.fromTime"))}
                {time("to_time", t("selfService.toTime"))}
              </div>
            )}
          </>
        )}
        {kind === "trip" && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormSelect label={t("selfService.trip.country")} name="country" value={String(v.country)} placeholder={t("common.choose")} options={countryOptions} onChange={(e) => set("country", e.target.value)} error={first("country")} required />
              <TextField label={t("selfService.trip.city")} name="city" value={String(v.city)} onChange={(e) => set("city", e.target.value)} error={first("city")} required />
              <FormSelect label={t("selfService.trip.transport")} name="transport" value={String(v.transport)} onChange={(e) => set("transport", e.target.value)} options={(["air", "car", "other"] as const).map((x) => ({ value: x, label: t(`selfService.trip.transports.${x}`) }))} />
              <TextField label={t("selfService.trip.advance")} name="advance" inputMode="decimal" dir="ltr" value={String(v.advance)} onChange={(e) => set("advance", e.target.value)} error={first("advance")} />
            </div>
            <TextArea label={t("selfService.mission.purpose")} name="purpose" rows={2} value={String(v.purpose)} onChange={(e) => set("purpose", e.target.value)} error={first("purpose")} required />
          </>
        )}
        {kind === "ticket" && (
          <>
            {!tickets?.policy ? (
              <Alert tone="warning">{t("selfService.ticket.noPolicy")}</Alert>
            ) : (
              <p className="num text-sm text-muted">
                {t("selfService.ticket.balance", { available: format.number(Number(tickets.available), [0, 2]), class: t(`selfService.ticket.classes.${tickets.policy.ticket_class}`) })}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <DateInput label={t("selfService.ticket.travel")} name="travel_date" value={String(v.travel_date) || null} onChange={(d) => set("travel_date", d ?? "")} error={first("travel_date")} required />
              <DateInput label={t("selfService.ticket.return")} name="return_date" value={String(v.return_date) || null} min={String(v.travel_date) || undefined} onChange={(d) => set("return_date", d ?? "")} hint={t("selfService.ticket.oneWay")} error={first("return_date")} />
              <TextField label={t("selfService.ticket.from")} name="from_city" value={String(v.from_city)} onChange={(e) => set("from_city", e.target.value)} required />
              <TextField label={t("selfService.ticket.to")} name="to_city" value={String(v.to_city)} onChange={(e) => set("to_city", e.target.value)} required />
              <FormSelect label={t("selfService.trip.country")} name="country" value={String(v.country)} placeholder="—" options={countryOptions} onChange={(e) => set("country", e.target.value)} />
            </div>
            {tickets?.policy?.includes_family && (tickets.family?.length ?? 0) > 0 && (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium text-ink">{t("selfService.ticket.family")}</legend>
                {tickets.family!.map((d) => (
                  <CheckField key={d.id} label={`${format.name(d)} · ${t(`dependents.relationships.${d.relationship}`, { defaultValue: d.relationship })}`} checked={family.includes(d.id)} onChange={(e) => setFamily(e.target.checked ? [...family, d.id] : family.filter((x) => x !== d.id))} />
                ))}
                {first("family") && <p className="text-sm text-danger">{first("family")}</p>}
              </fieldset>
            )}
            {tickets?.policy?.cash_allowed && <CheckField label={t("selfService.ticket.cash")} checked={Boolean(v.take_cash)} onChange={(e) => set("take_cash", e.target.checked)} />}
          </>
        )}
        {kind !== "mission" && kind !== "trip" && (
          <TextArea label={t("leave.reason")} name="reason" rows={2} value={String(v.reason)} onChange={(e) => set("reason", e.target.value)} />
        )}
        {preview && Object.keys(preview.errors).length === 0 && previewText(kind, preview) && (
          <p role="status" className="num rounded-card bg-teal-soft px-4 py-3 text-sm text-teal-ink">
            {previewText(kind, preview)}
          </p>
        )}
        {(errors.general || first("detail")) && <Alert>{errors.general ?? first("detail")}</Alert>}
      </div>
    </Dialog>
  );
}
