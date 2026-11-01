import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { hr } from "@/api/hr";
import { type DestinationClass, selfService, type TicketClass, type TicketPolicy } from "@/api/selfservice";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { Dialog } from "@/design/Dialog";
import { CheckField, FormSelect, TextField } from "@/design/Field";
import { Pill } from "@/design/Pill";
import NoAccess from "@/features/misc/NoAccessPage";
import { Page } from "@/layout/Page";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

const DESTINATIONS: DestinationClass[] = ["domestic", "gcc", "international"];
const ALL = "all"; // the row for every grade without its own

/** /settings/travel — the company's per diem by grade and destination (decision 8) and air-ticket policies by
 * grade (decision 7). Company policy, not law: both start empty. */
export default function TravelSettingsPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  if (!can("selfservice.manage_travel")) return <NoAccess />;
  return (
    <Page title={t("travel.title")}>
      <div className="flex flex-col gap-4">
        <PerDiemCard />
        <TicketPoliciesCard />
      </div>
    </Page>
  );
}

function useGrades() {
  const scope = useScopeKey();
  return useQuery({ queryKey: ["master", "grades", ...scope], queryFn: hr.grades });
}

function PerDiemCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const queryClient = useQueryClient();
  const grades = useGrades();
  const rates = useQuery({ queryKey: ["travel", "rates", ...scope], queryFn: selfService.perDiemRates });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const key = (grade: number | null, kind: DestinationClass) => `${grade ?? ALL}:${kind}`;
  const existing = (grade: number | null, kind: DestinationClass) =>
    (rates.data ?? []).find((r) => r.grade === grade && r.destination_class === kind);
  const save = useMutation({
    mutationFn: async () => {
      for (const [k, value] of Object.entries(draft)) {
        const [g, kind] = k.split(":") as [string, DestinationClass];
        const grade = g === ALL ? null : Number(g);
        const row = existing(grade, kind);
        if (value.trim() === "") {
          if (row) await selfService.deleteRate(row.id);
        } else if (row) {
          if (row.daily_amount !== value) await selfService.saveRate({ daily_amount: value.trim() }, row.id);
        } else {
          await selfService.saveRate({ grade, destination_class: kind, daily_amount: value.trim() });
        }
      }
    },
    onSuccess: async () => {
      setDraft({});
      await queryClient.invalidateQueries({ queryKey: ["travel"] });
    },
  });
  const rows: { id: number | null; name: string }[] = [
    { id: null, name: t("travel.everyGrade") },
    ...(grades.data?.results ?? []).map((g) => ({ id: g.id, name: format.name(g) })),
  ];
  const value = (grade: number | null, kind: DestinationClass) => draft[key(grade, kind)] ?? existing(grade, kind)?.daily_amount ?? "";

  return (
    <Card
      variant="solid"
      title={t("travel.perDiem")}
      subtitle={t("travel.perDiemHint")}
      action={
        <Button size="sm" disabled={!Object.keys(draft).length || save.isPending} onClick={() => save.mutate()}>
          {t("common.save")}
        </Button>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">{t("travel.perDiem")}</caption>
          <thead>
            <tr>
              <th scope="col" className="py-2 text-start font-medium text-muted">{t("travel.grade")}</th>
              {DESTINATIONS.map((d) => (
                <th key={d} scope="col" className="py-2 text-start font-medium text-muted">{t(`travel.destinations.${d}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id ?? ALL} className="border-t border-line">
                <th scope="row" className="py-2 pe-3 text-start font-medium">{row.name}</th>
                {DESTINATIONS.map((d) => (
                  <td key={d} className="py-2 pe-3">
                    <TextField
                      label={`${row.name} · ${t(`travel.destinations.${d}`)}`}
                      className="[&_label]:sr-only"
                      inputMode="decimal"
                      dir="ltr"
                      placeholder="—"
                      value={value(row.id, d)}
                      onChange={(e) => setDraft((x) => ({ ...x, [key(row.id, d)]: e.target.value }))}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {save.error && <Alert className="mt-3">{apiErrors(save.error, t("common.saveFailed")).general ?? Object.values(apiErrors(save.error, "").fields)[0]}</Alert>}
    </Card>
  );
}

function TicketPoliciesCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const grades = useGrades();
  const policies = useQuery({ queryKey: ["travel", "policies", ...scope], queryFn: selfService.ticketPolicies });
  const [editing, setEditing] = useState<TicketPolicy | "new" | null>(null);
  const gradeName = (id: number | null) =>
    id === null ? t("travel.everyGrade") : format.name((grades.data?.results ?? []).find((g) => g.id === id) ?? { name_ar: `#${id}`, name_en: "" });
  return (
    <Card
      variant="solid"
      title={t("travel.tickets")}
      subtitle={t("travel.ticketsHint")}
      action={
        <Button size="sm" variant="accent" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
          {t("travel.addPolicy")}
        </Button>
      }
    >
      {(policies.data ?? []).length === 0 ? (
        <p className="text-sm text-muted">{t("travel.noPolicies")}</p>
      ) : (
        <ul aria-label={t("travel.tickets")} className="flex flex-col divide-y divide-line">
          {(policies.data ?? []).map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="min-w-40 font-medium">{gradeName(p.grade)}</span>
              <Pill tone="sky">{t(`selfService.ticket.classes.${p.ticket_class}`)}</Pill>
              <span className="num text-sm">{t("travel.every", { months: p.every_months })}</span>
              {p.includes_family && <span className="text-sm text-muted">{t("travel.family", { max: p.family_members_max ?? "∞" })}</span>}
              {p.cash_allowed && <span className="text-sm text-muted">{t("travel.cash")}</span>}
              {!p.is_active && <Pill tone="navy">{t("leaveSettings.off")}</Pill>}
              <IconButton className="ms-auto" size="sm" variant="plain" label={t("common.editNamed", { name: gradeName(p.grade) })} icon={<Pencil />} onClick={() => setEditing(p)} />
            </li>
          ))}
        </ul>
      )}
      {editing && <PolicyDialog policy={editing === "new" ? undefined : editing} grades={(grades.data?.results ?? []).map((g) => ({ value: String(g.id), label: format.name(g) }))} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function PolicyDialog({ policy, grades, onClose }: { policy?: TicketPolicy; grades: { value: string; label: string }[]; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [v, setV] = useState({
    grade: policy?.grade ? String(policy.grade) : "",
    ticket_class: policy?.ticket_class ?? ("economy" as TicketClass),
    every_months: String(policy?.every_months ?? 12),
    includes_family: policy?.includes_family ?? false,
    family_members_max: policy?.family_members_max ? String(policy.family_members_max) : "",
    cash_allowed: policy?.cash_allowed ?? false,
    cash_amount: policy?.cash_amount ?? "",
    is_active: policy?.is_active ?? true,
  });
  const set = <K extends keyof typeof v>(key: K, value: (typeof v)[K]) => setV((x) => ({ ...x, [key]: value }));
  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: ["travel"] });
    onClose();
  };
  const save = useMutation({
    mutationFn: () =>
      selfService.savePolicy(
        {
          grade: v.grade ? Number(v.grade) : null,
          ticket_class: v.ticket_class,
          every_months: Number(v.every_months),
          includes_family: v.includes_family,
          family_members_max: v.includes_family && v.family_members_max ? Number(v.family_members_max) : null,
          cash_allowed: v.cash_allowed,
          cash_amount: v.cash_allowed && v.cash_amount ? v.cash_amount : null,
          is_active: v.is_active,
        },
        policy?.id,
      ),
    onSuccess: done,
  });
  const remove = useMutation({ mutationFn: () => selfService.deletePolicy(policy!.id), onSuccess: done });
  const errors = apiErrors(save.error ?? remove.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      onClose={onClose}
      title={policy ? t("travel.editPolicy") : t("travel.addPolicy")}
      footer={
        <>
          {policy && (
            <Button variant="outline" className="me-auto" disabled={remove.isPending} onClick={() => remove.mutate()}>
              {t("common.delete")}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormSelect label={t("travel.grade")} name="grade" value={v.grade} disabled={Boolean(policy)} placeholder={t("travel.everyGrade")} options={grades} onChange={(e) => set("grade", e.target.value)} error={errors.fields.grade} />
        <FormSelect label={t("travel.class")} name="ticket_class" value={v.ticket_class} onChange={(e) => set("ticket_class", e.target.value as TicketClass)} options={(["economy", "business", "first"] as const).map((c) => ({ value: c, label: t(`selfService.ticket.classes.${c}`) }))} />
        <TextField label={t("travel.everyMonths")} name="every_months" inputMode="numeric" dir="ltr" value={v.every_months} onChange={(e) => set("every_months", e.target.value)} error={errors.fields.every_months} />
        <CheckField label={t("leaveSettings.active")} checked={v.is_active} onChange={(e) => set("is_active", e.target.checked)} className="self-end pb-3" />
        <CheckField label={t("travel.includesFamily")} checked={v.includes_family} onChange={(e) => set("includes_family", e.target.checked)} />
        {v.includes_family && <TextField label={t("travel.familyMax")} inputMode="numeric" dir="ltr" value={v.family_members_max} onChange={(e) => set("family_members_max", e.target.value)} hint={t("travel.familyMaxHint")} />}
        <CheckField label={t("travel.cashAllowed")} checked={v.cash_allowed} onChange={(e) => set("cash_allowed", e.target.checked)} />
        {v.cash_allowed && <TextField label={t("travel.cashAmount")} inputMode="decimal" dir="ltr" value={v.cash_amount} onChange={(e) => set("cash_amount", e.target.value)} hint={t("travel.cashAmountHint")} />}
        {errors.general && <Alert className="sm:col-span-2">{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
