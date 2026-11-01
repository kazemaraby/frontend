import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { endpoints } from "@/api";
import { hr } from "@/api/hr";
import { accounting, type CostCenter, type JournalSettings } from "@/api/payroll";
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

/** Payroll settings → accounting (Phase 4 task 20): the journal's accounts (#104), the cost centers (#103) and the
 * cost center of each department and branch. An employee's own split is on their salary tab; a component's account
 * on the components tab. */
export function AccountingTab() {
  return (
    <div className="flex flex-col gap-6">
      <JournalSettingsCard />
      <CostCentersCard />
      <DefaultsCard />
    </div>
  );
}

const EMPTY: JournalSettings = { erp_company: "", payable_account: "", gosi_payable_account: "", expense_account: "", deduction_account: "", cost_center: null, party_per_employee: true };
const ACCOUNT_FIELDS = ["erp_company", "payable_account", "gosi_payable_account", "expense_account", "deduction_account"] as const;

function useCenters() {
  const scope = useScopeKey();
  return useQuery({ queryKey: ["cost-centers", ...scope], queryFn: accounting.centers });
}

function JournalSettingsCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const { can } = useSession();
  const manage = can("payroll.manage_settings");
  const queryClient = useQueryClient();
  const current = useQuery({ queryKey: ["journal-settings", ...scope], queryFn: accounting.settings });
  const centers = useCenters();
  const [v, setV] = useState<JournalSettings>(EMPTY);
  useEffect(() => {
    if (current.data) setV(current.data);
  }, [current.data]);
  const save = useMutation({ mutationFn: () => accounting.saveSettings(v), onSuccess: (data) => queryClient.setQueryData(["journal-settings", ...scope], data) });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Card variant="solid" title={t("accounting.settingsTitle")} subtitle={t("accounting.settingsHint")}>
      <div className="grid gap-4 sm:grid-cols-2">
        {ACCOUNT_FIELDS.map((name) => (
          <TextField key={name} label={t(`accounting.fields.${name}`)} name={name} dir="ltr" value={v[name]} disabled={!manage} onChange={(e) => setV({ ...v, [name]: e.target.value })} error={errors.fields[name]} />
        ))}
        <FormSelect label={t("accounting.fields.cost_center")} name="cost_center" value={v.cost_center ? String(v.cost_center) : ""} disabled={!manage} placeholder={t("accounting.none")} onChange={(e) => setV({ ...v, cost_center: e.target.value ? Number(e.target.value) : null })} options={(centers.data ?? []).filter((c) => c.is_active).map((c) => ({ value: String(c.id), label: `${c.code} — ${format.name(c)}` }))} />
        <CheckField className="sm:col-span-2" label={t("accounting.fields.party_per_employee")} checked={v.party_per_employee} disabled={!manage} onChange={(e) => setV({ ...v, party_per_employee: e.target.checked })} />
      </div>
      {save.isSuccess && <Alert tone="info" className="mt-3">{t("accounting.saved")}</Alert>}
      {errors.general && <Alert className="mt-3">{errors.general}</Alert>}
      {manage && (
        <div className="mt-3 flex justify-end">
          <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </div>
      )}
    </Card>
  );
}

function CostCentersCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const { can } = useSession();
  const manage = can("payroll.manage_settings");
  const centers = useCenters();
  const [editing, setEditing] = useState<Partial<CostCenter> | null>(null);
  const columns: Column<CostCenter>[] = [
    { id: "code", header: t("accounting.code"), cell: (c) => <span dir="ltr" className="num font-semibold">{c.code}</span> },
    { id: "name", header: t("accounting.name"), cell: (c) => format.name(c) },
    { id: "active", header: t("accounting.active"), cell: (c) => <Pill tone={c.is_active ? "green" : "neutral"}>{t(c.is_active ? "common.yes" : "common.no")}</Pill> },
    {
      id: "actions",
      header: <span className="sr-only">{t("common.actions")}</span>,
      cell: (c) => manage && <IconButton size="sm" variant="plain" label={t("accounting.edit", { code: c.code })} icon={<Pencil />} onClick={() => setEditing(c)} />,
    },
  ];
  return (
    <Card
      variant="solid"
      title={t("accounting.centersTitle")}
      subtitle={t("accounting.centersHint")}
      action={manage && <Button size="sm" variant="accent" icon={<Plus className="size-4" />} onClick={() => setEditing({ code: "", name_ar: "", name_en: "", is_active: true })}>{t("accounting.addCenter")}</Button>}
    >
      <DataTable caption={t("accounting.centersTitle")} columns={columns} rows={centers.data ?? []} rowKey={(c) => String(c.id)} loading={centers.isPending} empty={t("accounting.noCenters")} minWidth={520} />
      {editing && <CenterDialog center={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function CenterDialog({ center, onClose }: { center: Partial<CostCenter>; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [v, setV] = useState(center);
  const save = useMutation({
    mutationFn: () => accounting.saveCenter({ code: v.code, name_ar: v.name_ar, name_en: v.name_en, is_active: v.is_active }, center.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cost-centers"] });
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      onClose={onClose}
      title={center.id ? t("accounting.edit", { code: center.code }) : t("accounting.addCenter")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!v.code?.trim() || !v.name_ar?.trim() || save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField label={t("accounting.code")} name="code" dir="ltr" hint={t("accounting.codeHint")} value={v.code ?? ""} onChange={(e) => setV({ ...v, code: e.target.value })} error={errors.fields.code} />
        <TextField label={t("accounting.nameAr")} name="name_ar" value={v.name_ar ?? ""} onChange={(e) => setV({ ...v, name_ar: e.target.value })} error={errors.fields.name_ar} />
        <TextField label={t("accounting.nameEn")} name="name_en" dir="ltr" value={v.name_en ?? ""} onChange={(e) => setV({ ...v, name_en: e.target.value })} />
        <CheckField label={t("accounting.active")} checked={Boolean(v.is_active)} onChange={(e) => setV({ ...v, is_active: e.target.checked })} />
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

/** Each department's and branch's cost center (all of its cost; an employee's own split comes first, then the
 * department's, then the branch's, then the company's default). */
function DefaultsCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const { can } = useSession();
  const manage = can("payroll.manage_settings");
  const queryClient = useQueryClient();
  const centers = useCenters();
  const allocations = useQuery({ queryKey: ["cost-allocations", ...scope], queryFn: accounting.allocations });
  const departments = useQuery({ queryKey: ["departments", ...scope], queryFn: endpoints.departments, select: (page) => page.results });
  const branches = useQuery({ queryKey: ["branches", "all", ...scope], queryFn: hr.branches, select: (page) => page.results });
  const set = useMutation({
    mutationFn: ({ target, id, center }: { target: "department" | "branch"; id: number; center: string }) => accounting.allocate(target, id, center ? [{ cost_center: Number(center), percent: 100 }] : []),
    onSuccess: (data) => queryClient.setQueryData(["cost-allocations", ...scope], data),
  });
  const errors = apiErrors(set.error, t("common.saveFailed"));
  const options = (centers.data ?? []).filter((c) => c.is_active).map((c) => ({ value: String(c.id), label: `${c.code} — ${format.name(c)}` }));
  const current = (target: "department" | "branch", id: number) => {
    const rows = allocations.data?.[target][String(id)] ?? [];
    return rows.length === 1 ? String(rows[0].cost_center) : rows.length ? "split" : "";
  };
  const group = (target: "department" | "branch", items: { id: number; name_ar: string; name_en?: string }[]) => (
    <section aria-label={t(`accounting.${target}s`)} className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{t(`accounting.${target}s`)}</h3>
      {items.map((item) => (
        <FormSelect
          key={item.id}
          label={format.name(item)}
          name={`${target}-${item.id}`}
          value={current(target, item.id)}
          disabled={!manage || set.isPending}
          placeholder={t("accounting.followNext")}
          onChange={(e) => set.mutate({ target, id: item.id, center: e.target.value })}
          options={current(target, item.id) === "split" ? [{ value: "split", label: t("accounting.split") }, ...options] : options}
        />
      ))}
    </section>
  );
  return (
    <Card variant="solid" title={t("accounting.defaultsTitle")} subtitle={t("accounting.defaultsHint")}>
      <div className="grid gap-6 sm:grid-cols-2">
        {group("department", departments.data ?? [])}
        {group("branch", branches.data ?? [])}
      </div>
      {(errors.fields.rows || errors.general) && <Alert className="mt-3">{errors.fields.rows ?? errors.general}</Alert>}
    </Card>
  );
}
