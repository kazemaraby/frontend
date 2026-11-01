import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { discipline, type Violation } from "@/api/discipline";
import type { Penalty, PenaltyType } from "@/api/payroll";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { Dialog } from "@/design/Dialog";
import { CheckField, FormSelect, TextField } from "@/design/Field";
import { Pill } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

import { usePenaltyText } from "./PenaltiesTab";

const TYPES: PenaltyType[] = ["warning", "percent", "days", "days_or_hold", "dismissal_award", "dismissal_art80"];
const WITH_VALUE: PenaltyType[] = ["percent", "days", "days_or_hold"];

/** Work violations (Phase 4 task 10, #91): the violations that aren't about working hours, each with its penalty for
 * the 1st to 4th time. The account's list is seeded from the MHRSD model regulation; a company adds its own. */
export function ViolationsTab() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const { can } = useSession();
  const manage = can("employees.manage_discipline");
  const list = useQuery({ queryKey: ["violations", ...scope], queryFn: discipline.violations, enabled: manage });
  const text = usePenaltyText();
  const [editing, setEditing] = useState<Violation | "new" | null>(null);
  const columns: Column<Violation>[] = [
    { id: "name", header: t("discipline.violation"), cell: (v) => <span className="flex flex-col gap-1"><span className="font-medium">{format.name(v)}</span>{v.company === null ? <Pill tone="neutral">{t("discipline.accountRow")}</Pill> : <Pill tone="teal">{t("discipline.companyRow")}</Pill>}</span> },
    { id: "category", header: t("discipline.category"), cell: (v) => t(`discipline.categories.${v.category}`) },
    ...[0, 1, 2, 3].map((i) => ({ id: `p${i}`, header: t(`penalties.times.${i}`), cell: (v: Violation) => <span className="text-sm">{v.penalties[i] ? text(v.penalties[i]) : "—"}</span> })),
    { id: "edit", header: <span className="sr-only">{t("common.actions")}</span>, cell: (v) => <IconButton size="sm" variant="plain" label={t("common.editNamed", { name: format.name(v) })} icon={<Pencil />} onClick={() => setEditing(v)} /> },
  ];
  if (!manage) return <Alert tone="info">{t("discipline.noAccess")}</Alert>;
  return (
    <Card
      variant="solid"
      title={t("discipline.violationsTitle")}
      subtitle={t("discipline.violationsHint")}
      action={
        <Button size="sm" variant="accent" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
          {t("discipline.addViolation")}
        </Button>
      }
    >
      <DataTable caption={t("discipline.violationsTitle")} columns={columns} rows={list.data ?? []} rowKey={(v) => String(v.id)} loading={list.isPending} minWidth={980} />
      {editing && <ViolationDialog violation={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

const BLANK: Penalty[] = [{ type: "warning" }, { type: "percent", value: 10 }, { type: "percent", value: 25 }, { type: "days", value: 1 }];

function ViolationDialog({ violation, onClose }: { violation?: Violation; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [v, setV] = useState({ name_ar: violation?.name_ar ?? "", name_en: violation?.name_en ?? "", category: violation?.category ?? "work", penalties: (violation?.penalties ?? BLANK).map((p) => ({ ...p })), is_active: violation?.is_active ?? true });
  const save = useMutation({
    mutationFn: () => discipline.saveViolation({ ...v, penalties: v.penalties.map((p) => (WITH_VALUE.includes(p.type) ? { type: p.type, value: Number(p.value) } : { type: p.type })) }, violation?.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["violations"] });
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const setPenalty = (i: number, patch: Partial<Penalty>) => setV((x) => ({ ...x, penalties: x.penalties.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));
  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={violation ? t("common.editNamed", { name: violation.name_ar }) : t("discipline.addViolation")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!v.name_ar.trim() || save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label={t("letters.nameAr")} name="name_ar" value={v.name_ar} onChange={(e) => setV({ ...v, name_ar: e.target.value })} error={errors.fields.name_ar} required />
          <TextField label={t("letters.nameEn")} name="name_en" dir="ltr" value={v.name_en} onChange={(e) => setV({ ...v, name_en: e.target.value })} />
          <FormSelect label={t("discipline.category")} name="category" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value as Violation["category"] })} options={(["work", "behaviour", "other"] as const).map((c) => ({ value: c, label: t(`discipline.categories.${c}`) }))} />
        </div>
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-1 font-semibold text-ink">{t("penalties.penaltiesTitle")}</legend>
          {v.penalties.map((p, i) => (
            <div key={i} className="flex gap-2 rounded-card border border-line p-3">
              <FormSelect label={t(`penalties.times.${i}`)} name={`type-${i}`} value={p.type} onChange={(e) => setPenalty(i, { type: e.target.value as PenaltyType })} options={TYPES.map((type) => ({ value: type, label: t(`penalties.typeNames.${type}`) }))} />
              {WITH_VALUE.includes(p.type) && <TextField label={p.type === "percent" ? "%" : t("penalties.days")} name={`value-${i}`} dir="ltr" inputMode="decimal" value={String(p.value ?? "")} onChange={(e) => setPenalty(i, { value: Number(e.target.value) })} className="w-24" />}
            </div>
          ))}
        </fieldset>
        {errors.fields.penalties && <Alert>{errors.fields.penalties}</Alert>}
        <CheckField label={t("leaveSettings.active")} checked={v.is_active} onChange={(e) => setV({ ...v, is_active: e.target.checked })} />
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
