import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { type ComponentInput, type ComponentKind, type ComponentMethod, components, type FormulaCheck, type PackageField, type PayComponent } from "@/api/payroll";
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

const KINDS: ComponentKind[] = ["earning", "deduction", "employer_cost"];
const METHODS: ComponentMethod[] = ["contract", "fixed", "percent", "formula", "attendance", "monthly_input", "system"];
const PACKAGE: PackageField[] = ["basic_salary", "housing_allowance", "transport_allowance", "other_allowances"];
const FLAGS = ["in_gosi_wage", "in_eosb_wage", "in_daily_wage", "prorated", "on_payslip", "taxable_abroad"] as const;
const KIND_TONES = { earning: "green", deduction: "salmon", employer_cost: "navy" } as const;

/** Salary components (Phase 4 task 3, #94): what each payslip line is and how its amount is found. The starting
 * components keep their code and method; formulas are checked as they are typed (apps/payroll/formula.py). */
export function ComponentsTab() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const { can } = useSession();
  const manage = can("payroll.manage_settings");
  const list = useQuery({ queryKey: ["pay-components", ...scope], queryFn: components.list });
  const [editing, setEditing] = useState<PayComponent | "new" | null>(null);
  const columns: Column<PayComponent>[] = [
    { id: "code", header: t("components.code"), cell: (c) => <span dir="ltr" className="num font-semibold">{c.code}</span>, className: "w-36" },
    { id: "name", header: t("components.name"), cell: (c) => format.name(c) },
    { id: "kind", header: t("components.kind"), cell: (c) => <Pill tone={KIND_TONES[c.kind]}>{t(`components.kinds.${c.kind}`)}</Pill> },
    {
      id: "method",
      header: t("components.method"),
      cell: (c) => (
        <span className="flex flex-col text-sm">
          <span>{t(`components.methods.${c.method}`)}</span>
          {c.method === "formula" && <span dir="ltr" className="num truncate text-xs text-muted">{c.formula}</span>}
          {c.method === "percent" && <span className="num text-xs text-muted">{t("components.percentOf", { percent: c.percent, of: list.data?.find((x) => x.id === c.percent_of)?.code ?? "" })}</span>}
        </span>
      ),
    },
    {
      id: "flags",
      header: t("components.wages"),
      cell: (c) => (
        <span className="flex flex-wrap gap-1">
          {(["in_gosi_wage", "in_eosb_wage", "in_daily_wage"] as const).filter((f) => c[f]).map((f) => <Pill key={f} tone="teal">{t(`components.short.${f}`)}</Pill>)}
          {!c.is_active && <Pill tone="navy">{t("leaveSettings.off")}</Pill>}
        </span>
      ),
    },
    ...(manage ? [{ id: "edit", header: <span className="sr-only">{t("common.actions")}</span>, cell: (c: PayComponent) => <IconButton size="sm" variant="plain" label={t("common.editNamed", { name: c.code })} icon={<Pencil />} onClick={() => setEditing(c)} /> }] : []),
  ];
  return (
    <Card
      variant="solid"
      title={t("components.title")}
      subtitle={t("components.hint")}
      action={manage && <Button size="sm" variant="accent" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>{t("components.add")}</Button>}
    >
      <DataTable caption={t("components.title")} columns={columns} rows={list.data ?? []} rowKey={(c) => String(c.id)} loading={list.isPending} minWidth={860} />
      {editing && <ComponentDialog component={editing === "new" ? undefined : editing} all={list.data ?? []} onClose={() => setEditing(null)} />}
    </Card>
  );
}

const EMPTY: ComponentInput = {
  code: "", name_ar: "", name_en: "", kind: "earning", method: "fixed", contract_field: "", percent: null, percent_of: null, formula: "",
  in_gosi_wage: false, in_eosb_wage: false, in_daily_wage: false, prorated: true, on_payslip: true, taxable_abroad: false, gl_account: "", order: 100, is_active: true,
};

function ComponentDialog({ component, all, onClose }: { component?: PayComponent; all: PayComponent[]; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [v, setV] = useState<ComponentInput>(component ? { ...EMPTY, ...component } : EMPTY);
  const locked = Boolean(component?.is_system); // a starting component keeps its code, kind and method
  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: ["pay-components"] });
    onClose();
  };
  const save = useMutation({ mutationFn: () => components.save(component ? { ...v, ...(locked ? { code: undefined, kind: undefined, method: undefined, contract_field: undefined } : {}) } : v, component?.id), onSuccess: done });
  const remove = useMutation({ mutationFn: () => components.remove(component!.id), onSuccess: done });
  const errors = apiErrors(save.error ?? remove.error, t("common.saveFailed"));
  const set = <K extends keyof ComponentInput>(key: K, value: ComponentInput[K]) => setV((x) => ({ ...x, [key]: value }));
  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={component ? t("common.editNamed", { name: component.code }) : t("components.add")}
      footer={
        <>
          {component && !component.is_system && (
            <Button variant="outline" className="me-auto" disabled={remove.isPending} onClick={() => remove.mutate()}>
              {t("common.delete")}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!v.code.trim() || !v.name_ar.trim() || save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label={t("components.code")} name="code" dir="ltr" value={v.code} disabled={locked} onChange={(e) => set("code", e.target.value.toUpperCase())} error={errors.fields.code} hint={t("components.codeHint")} required />
          <TextField label={t("letters.nameAr")} name="name_ar" value={v.name_ar} onChange={(e) => set("name_ar", e.target.value)} error={errors.fields.name_ar} required />
          <TextField label={t("letters.nameEn")} name="name_en" dir="ltr" value={v.name_en} onChange={(e) => set("name_en", e.target.value)} />
          <FormSelect label={t("components.kind")} name="kind" value={v.kind} disabled={locked} onChange={(e) => set("kind", e.target.value as ComponentKind)} options={KINDS.map((k) => ({ value: k, label: t(`components.kinds.${k}`) }))} error={errors.fields.kind} />
          <FormSelect label={t("components.method")} name="method" value={v.method} disabled={locked} onChange={(e) => set("method", e.target.value as ComponentMethod)} options={METHODS.filter((m) => locked || (m !== "system" && m !== "attendance")).map((m) => ({ value: m, label: t(`components.methods.${m}`) }))} error={errors.fields.method} />
          <TextField label={t("components.order")} name="order" dir="ltr" inputMode="numeric" value={String(v.order)} onChange={(e) => set("order", Number(e.target.value) || 0)} />
        </div>
        {v.method === "contract" && (
          <FormSelect label={t("components.contractField")} name="contract_field" value={v.contract_field} disabled={locked} placeholder={t("components.choose")} onChange={(e) => set("contract_field", e.target.value as PackageField)} options={PACKAGE.map((f) => ({ value: f, label: t(`components.package.${f}`) }))} error={errors.fields.contract_field} />
        )}
        {v.method === "percent" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label={t("components.percent")} name="percent" dir="ltr" inputMode="decimal" value={v.percent ?? ""} onChange={(e) => set("percent", e.target.value || null)} error={errors.fields.percent} />
            <FormSelect label={t("components.of")} name="percent_of" value={v.percent_of ? String(v.percent_of) : ""} placeholder={t("components.choose")} onChange={(e) => set("percent_of", e.target.value ? Number(e.target.value) : null)} options={all.filter((c) => c.id !== component?.id && c.kind === "earning").map((c) => ({ value: String(c.id), label: c.code }))} error={errors.fields.percent_of} />
          </div>
        )}
        {v.method === "formula" && <FormulaField value={v.formula} onChange={(formula) => set("formula", formula)} error={errors.fields.formula} />}
        <fieldset className="grid gap-2 sm:grid-cols-3">
          <legend className="mb-1 font-semibold text-ink">{t("components.flagsTitle")}</legend>
          {FLAGS.map((f) => (
            <CheckField key={f} label={t(`components.flags.${f}`)} checked={v[f]} onChange={(e) => set(f, e.target.checked)} />
          ))}
          <CheckField label={t("leaveSettings.active")} checked={v.is_active} onChange={(e) => set("is_active", e.target.checked)} />
        </fieldset>
        <TextField label={t("components.glAccount")} name="gl_account" dir="ltr" value={v.gl_account} onChange={(e) => set("gl_account", e.target.value)} />
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

/** A formula with its live check on sample values and the names it may use. */
export function FormulaField({ value, onChange, error, label }: { value: string; onChange: (value: string) => void; error?: string | null; label?: string }) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const names = useQuery({ queryKey: ["pay-component-names", ...scope], queryFn: components.names, staleTime: 60_000 });
  const [check, setCheck] = useState<FormulaCheck | null>(null);
  useEffect(() => {
    if (!value.trim()) return setCheck(null);
    let live = true;
    const timer = window.setTimeout(() => {
      components
        .check(value)
        .then((r) => live && setCheck(r))
        .catch(() => live && setCheck(null));
    }, 300);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [value]);
  return (
    <div className="flex flex-col gap-2">
      <TextArea label={label ?? t("components.formula")} name="formula" dir="ltr" rows={2} value={value} onChange={(e) => onChange(e.target.value)} error={error ?? (check && !check.ok ? check.error : undefined)} />
      {check?.ok && (
        <p role="status" className="num text-sm text-teal-dark">
          {t("components.sampleValue", { value: format.number(Number(check.value), [2, 2]) })}
        </p>
      )}
      {names.data && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted">{t("components.namesTitle")}</summary>
          <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {names.data.variables.map((n) => (
              <div key={n.name} className="flex gap-2">
                <dt dir="ltr" className="num font-semibold">{n.name}</dt>
                <dd className="text-muted">{n.label}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-muted">
            {t("components.namesCodes")}{" "}
            <span dir="ltr" className="num">{names.data.components.map((c) => c.code).join(" · ")}</span>
          </p>
          <p className="text-muted">
            {t("components.namesFunctions")}{" "}
            <span dir="ltr" className="num">{names.data.functions.join(" · ")}</span>
          </p>
        </details>
      )}
    </div>
  );
}
