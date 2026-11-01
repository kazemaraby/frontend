import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { hr } from "@/api/hr";
import { components, type SalaryStructure, type StructureLine, structures } from "@/api/payroll";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { Dialog } from "@/design/Dialog";
import { CheckField, FormSelect, TextArea, TextField } from "@/design/Field";
import { Pill } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

import { FormulaField } from "./ComponentsTab";

/** Salary structures (Phase 4 task 3, #94): which components an employee gets and the amount or formula of each.
 * An employee's structure is their own, else their grade's, else the company default. */
export function StructuresTab() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const { can } = useSession();
  const manage = can("payroll.manage_settings");
  const list = useQuery({ queryKey: ["salary-structures", ...scope], queryFn: structures.list });
  const grades = useQuery({ queryKey: ["master", "grades", ...scope], queryFn: hr.grades, select: (page) => page.results });
  const [editing, setEditing] = useState<SalaryStructure | "new" | null>(null);
  const gradeName = (id: number) => {
    const g = grades.data?.find((x) => x.id === id);
    return g ? format.name(g) : "";
  };
  const columns: Column<SalaryStructure>[] = [
    {
      id: "name",
      header: t("structures.name"),
      cell: (s) => (
        <span className="flex flex-col">
          <span className="font-semibold">{format.name(s)}</span>
          {s.description && <span className="text-xs text-muted">{s.description}</span>}
        </span>
      ),
    },
    { id: "lines", header: t("structures.lines"), cell: (s) => <span className="num">{format.number(s.lines.length)}</span>, className: "w-28" },
    { id: "grades", header: t("structures.grades"), cell: (s) => <span className="text-sm">{s.grades.map(gradeName).join(" · ") || "—"}</span> },
    {
      id: "state",
      header: t("structures.state"),
      cell: (s) => (
        <span className="flex flex-wrap gap-1">
          {s.is_default && <Pill tone="teal">{t("structures.default")}</Pill>}
          {!s.is_active && <Pill tone="navy">{t("leaveSettings.off")}</Pill>}
        </span>
      ),
    },
    ...(manage ? [{ id: "edit", header: <span className="sr-only">{t("common.actions")}</span>, cell: (s: SalaryStructure) => <IconButton size="sm" variant="plain" label={t("common.editNamed", { name: format.name(s) })} icon={<Pencil />} onClick={() => setEditing(s)} /> }] : []),
  ];
  return (
    <Card
      variant="solid"
      title={t("structures.title")}
      subtitle={t("structures.hint")}
      action={manage && <Button size="sm" variant="accent" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>{t("structures.add")}</Button>}
    >
      <DataTable caption={t("structures.title")} columns={columns} rows={list.data ?? []} rowKey={(s) => String(s.id)} loading={list.isPending} minWidth={720} />
      {editing && <StructureDialog structure={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

type Draft = Omit<SalaryStructure, "id">;
const EMPTY: Draft = { name_ar: "", name_en: "", description: "", is_default: false, is_active: true, grades: [], lines: [] };

function StructureDialog({ structure, onClose }: { structure?: SalaryStructure; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const queryClient = useQueryClient();
  const all = useQuery({ queryKey: ["pay-components", ...scope], queryFn: components.list });
  const grades = useQuery({ queryKey: ["master", "grades", ...scope], queryFn: hr.grades, select: (page) => page.results });
  const [v, setV] = useState<Draft>(structure ? { ...EMPTY, ...structure } : EMPTY);
  // only components a structure can carry: from the contract, fixed, percent or formula
  const usable = (all.data ?? []).filter((c) => c.is_active && ["contract", "fixed", "percent", "formula"].includes(c.method));
  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: ["salary-structures"] });
    onClose();
  };
  const save = useMutation({ mutationFn: () => structures.save(v, structure?.id), onSuccess: done });
  const remove = useMutation({ mutationFn: () => structures.remove(structure!.id), onSuccess: done });
  const errors = apiErrors(save.error ?? remove.error, t("common.saveFailed"));
  const setLine = (i: number, patch: Partial<StructureLine>) => setV((x) => ({ ...x, lines: x.lines.map((ln, j) => (j === i ? { ...ln, ...patch } : ln)) }));
  const free = usable.filter((c) => !v.lines.some((ln) => ln.component === c.id));
  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={structure ? t("common.editNamed", { name: format.name(structure) }) : t("structures.add")}
      footer={
        <>
          {structure && !structure.is_default && (
            <Button variant="outline" className="me-auto" disabled={remove.isPending} onClick={() => remove.mutate()}>
              {t("common.delete")}
            </Button>
          )}
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
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("letters.nameAr")} name="name_ar" value={v.name_ar} onChange={(e) => setV({ ...v, name_ar: e.target.value })} error={errors.fields.name_ar} required />
          <TextField label={t("letters.nameEn")} name="name_en" dir="ltr" value={v.name_en} onChange={(e) => setV({ ...v, name_en: e.target.value })} />
        </div>
        <TextArea label={t("structures.description")} name="description" rows={2} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
        <div className="flex flex-wrap gap-6">
          <CheckField label={t("structures.isDefault")} checked={v.is_default} onChange={(e) => setV({ ...v, is_default: e.target.checked })} />
          <CheckField label={t("leaveSettings.active")} checked={v.is_active} onChange={(e) => setV({ ...v, is_active: e.target.checked })} />
        </div>
        {(grades.data ?? []).length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-semibold text-ink">{t("structures.grades")}</legend>
            <p className="text-sm text-muted">{t("structures.gradesHint")}</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {grades.data!.map((g) => (
                <CheckField
                  key={g.id}
                  label={format.name(g)}
                  checked={v.grades.includes(g.id)}
                  onChange={(e) => setV({ ...v, grades: e.target.checked ? [...v.grades, g.id] : v.grades.filter((x) => x !== g.id) })}
                />
              ))}
            </div>
            {errors.fields.grades && <Alert>{errors.fields.grades}</Alert>}
          </fieldset>
        )}
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 font-semibold text-ink">{t("structures.lines")}</legend>
          <p className="text-sm text-muted">{t("structures.linesHint")}</p>
          {v.lines.map((ln, i) => {
            const c = usable.find((x) => x.id === ln.component) ?? all.data?.find((x) => x.id === ln.component);
            const takes = c?.method === "fixed" ? "amount" : c?.method === "formula" ? "formula" : "none";
            return (
              <div key={ln.component} className="flex flex-col gap-2 rounded-card border border-line p-3">
                <div className="flex items-center gap-2">
                  <span dir="ltr" className="num font-semibold">{c?.code}</span>
                  <span className="flex-1">{c ? format.name(c) : ""}</span>
                  <IconButton size="xs" variant="danger" label={t("common.delete")} icon={<Trash2 />} onClick={() => setV({ ...v, lines: v.lines.filter((_, j) => j !== i) })} />
                </div>
                {takes === "amount" && <TextField label={t("structures.amount")} name={`amount-${i}`} dir="ltr" inputMode="decimal" value={ln.amount ?? ""} onChange={(e) => setLine(i, { amount: e.target.value || null })} hint={t("structures.amountHint")} />}
                {takes === "formula" && <FormulaField label={t("structures.formulaOverride")} value={ln.formula} onChange={(formula) => setLine(i, { formula })} />}
                {takes === "none" && <p className="text-sm text-muted">{t(`structures.from.${c?.method ?? "contract"}`)}</p>}
              </div>
            );
          })}
          {free.length > 0 && (
            <FormSelect
              label={t("structures.addLine")}
              name="add-line"
              value=""
              placeholder={t("components.choose")}
              onChange={(e) => e.target.value && setV({ ...v, lines: [...v.lines, { component: Number(e.target.value), amount: null, formula: "" }] })}
              options={free.map((c) => ({ value: String(c.id), label: `${c.code} — ${format.name(c)}` }))}
            />
          )}
          {errors.fields.lines && <Alert>{errors.fields.lines}</Alert>}
        </fieldset>
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
