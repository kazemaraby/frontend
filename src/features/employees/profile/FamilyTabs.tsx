import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Plus, Upload } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type Employee, holds } from "@/api";
import { type Dependent, formData, hr, type InsuranceMember, type Relationship } from "@/api/hr";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { DateInput } from "@/design/DateInput";
import { Dialog } from "@/design/Dialog";
import { CheckField, FormSelect, TextField } from "@/design/Field";
import { Pill } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { toISODate } from "@/lib/format";
import { useFormat } from "@/lib/useFormat";
import { checkArabicName, checkEnglishName, checkIdNumber } from "@/lib/validators";

import { UploadDialog } from "../dialogs/UploadDialog";
import { openFile } from "../download";
import type { MasterData } from "../masterData";
import { ID_TYPES, MARITAL } from "./fields";

const RELATIONSHIPS: Relationship[] = ["spouse", "son", "daughter", "father", "mother", "brother", "sister", "other"];

// --- dependents ------------------------------------------------------------------------------------

export function DependentsTab({ employee, master }: { employee: Employee; master: MasterData }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const dependents = useQuery({ queryKey: ["employee", employee.id, "dependents"], queryFn: () => hr.dependents(employee.id) });
  const manage = holds(employee, "employees.change_personal");
  const remove = useMutation({
    mutationFn: (d: Dependent) => hr.deleteDependent(d.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employee", employee.id] }),
  });

  const columns: Column<Dependent>[] = [
    { id: "name", header: t("dependents.name"), cell: (d) => <span className="font-medium">{format.name(d)}</span> },
    { id: "relationship", header: t("dependents.relationship"), cell: (d) => t(`dependents.relationships.${d.relationship}`) },
    { id: "dob", header: t("employee.fields.date_of_birth"), cell: (d) => (d.date_of_birth ? format.date(d.date_of_birth) : "—") },
    { id: "id", header: t("employee.fields.id_number"), cell: (d) => <span className="num" dir="ltr">{d.id_number || "—"}</span> },
    {
      id: "insurance",
      header: t("dependents.insurance"),
      cell: (d) =>
        d.insured ? (
          <Pill tone="green">{t("dependents.insured")}</Pill>
        ) : d.insurance_required ? (
          <Pill tone="salmon">{t("dependents.mustInsure")}</Pill>
        ) : (
          <Pill tone="neutral">{t("dependents.notInsured")}</Pill>
        ),
    },
  ];
  return (
    <Card
      variant="solid"
      title={t("dependents.title")}
      action={
        manage ? (
          <Button size="sm" variant="accent" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
            {t("dependents.add")}
          </Button>
        ) : undefined
      }
    >
      {remove.isError && <Alert className="mb-3">{apiErrors(remove.error, t("common.saveFailed")).general}</Alert>}
      <DataTable
        caption={t("dependents.title")}
        columns={columns}
        rows={dependents.data ?? []}
        rowKey={(d) => String(d.id)}
        rowLabel={(d) => format.name(d)}
        loading={dependents.isPending}
        onDelete={manage ? (d) => remove.mutate(d) : undefined}
        minWidth={720}
        empty={t("dependents.none")}
      />
      {adding && <DependentDialog employee={employee} master={master} onClose={() => setAdding(false)} />}
    </Card>
  );
}

function DependentDialog({ employee, master, onClose }: { employee: Employee; master: MasterData; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [v, setV] = useState<Record<string, string | boolean>>({ relationship: "son", is_working: false, on_iqama: false });
  const [local, setLocal] = useState<Record<string, string>>({});
  const set = (key: string) => (value: string | boolean | null) => setV((x) => ({ ...x, [key]: value ?? "" }));
  const save = useMutation({
    mutationFn: (body: Partial<Dependent>) => hr.createDependent(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["employee", employee.id] });
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const error = (k: string) => local[k] ?? errors.fields[k];

  function submit() {
    const problems: Record<string, string> = {};
    const name = checkArabicName(String(v.name_ar ?? ""));
    if (!v.name_ar) problems.name_ar = t("validation.required");
    else if (name.error) problems.name_ar = t(`validation.${name.error}`);
    const en = checkEnglishName(String(v.name_en ?? ""));
    if (en.error) problems.name_en = t(`validation.${en.error}`);
    let idNumber = String(v.id_number ?? "");
    if (idNumber) {
      const checked = checkIdNumber(idNumber, (v.id_type as "iqama") || undefined);
      if (checked.error) problems.id_number = t(`validation.${checked.error}`);
      else idNumber = checked.value;
    }
    setLocal(problems);
    if (Object.keys(problems).length) return;
    const body: Record<string, unknown> = { ...v, employee: employee.id, id_number: idNumber };
    for (const key of ["date_of_birth", "nationality"]) if (!body[key]) body[key] = null;
    save.mutate(body as Partial<Dependent>);
  }

  const showIqama = employee.id_type === "iqama";
  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={t("dependents.add")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={save.isPending} onClick={submit}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t("dependents.nameAr")} value={String(v.name_ar ?? "")} onChange={(e) => set("name_ar")(e.target.value)} error={error("name_ar")} />
        <TextField label={t("dependents.nameEn")} dir="ltr" value={String(v.name_en ?? "")} onChange={(e) => set("name_en")(e.target.value)} error={error("name_en")} />
        <FormSelect
          label={t("dependents.relationship")}
          value={String(v.relationship)}
          onChange={(e) => set("relationship")(e.target.value)}
          options={RELATIONSHIPS.map((r) => ({ value: r, label: t(`dependents.relationships.${r}`) }))}
          error={error("relationship") ?? error("gender")}
        />
        <DateInput label={t("employee.fields.date_of_birth")} value={(v.date_of_birth as string) || null} onChange={set("date_of_birth")} hijri error={error("date_of_birth")} />
        <FormSelect label={t("employee.fields.nationality")} value={String(v.nationality ?? "")} onChange={(e) => set("nationality")(e.target.value)} placeholder={t("common.choose")} options={master.options.countries} error={error("nationality")} />
        <FormSelect label={t("employee.fields.marital_status")} value={String(v.marital_status ?? "")} onChange={(e) => set("marital_status")(e.target.value)} placeholder={t("common.choose")} options={MARITAL.map((m) => ({ value: m, label: t(`employee.marital.${m}`) }))} />
        <FormSelect label={t("employee.fields.id_type")} value={String(v.id_type ?? "")} onChange={(e) => set("id_type")(e.target.value)} placeholder={t("common.choose")} options={ID_TYPES.map((x) => ({ value: x, label: t(`employee.idType.${x}`) }))} error={error("id_type")} />
        <TextField label={t("employee.fields.id_number")} dir="ltr" value={String(v.id_number ?? "")} onChange={(e) => set("id_number")(e.target.value)} error={error("id_number")} />
        <CheckField label={t("dependents.isWorking")} checked={Boolean(v.is_working)} onChange={(e) => set("is_working")(e.target.checked)} />
        {showIqama && <CheckField label={t("dependents.onIqama")} checked={Boolean(v.on_iqama)} onChange={(e) => set("on_iqama")(e.target.checked)} />}
      </div>
      {(errors.general || errors.fields.on_iqama) && <Alert className="mt-4">{errors.fields.on_iqama ?? errors.general}</Alert>}
    </Dialog>
  );
}

// --- medical insurance -----------------------------------------------------------------------------

export function InsuranceTab({ employee }: { employee: Employee }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [card, setCard] = useState<InsuranceMember | null>(null);
  const members = useQuery({ queryKey: ["employee", employee.id, "insurance"], queryFn: () => hr.insurance(employee.id) });
  const dependents = useQuery({ queryKey: ["employee", employee.id, "dependents"], queryFn: () => hr.dependents(employee.id) });
  const policies = useQuery({ queryKey: ["insurance-policies", employee.company], queryFn: hr.policies });
  const manage = holds(employee, "employees.change_personal");
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["employee", employee.id] });
  const remove = useMutation({ mutationFn: (m: InsuranceMember) => hr.deleteMember(m.id), onSuccess: refresh });
  const view = useMutation({ mutationFn: (m: InsuranceMember) => openFile(() => hr.memberLink(m.id)) });

  const personName = (m: InsuranceMember) => {
    const dependent = dependents.data?.find((d) => d.id === m.dependent);
    return dependent ? format.name(dependent) : format.name(employee);
  };
  const policyNo = (m: InsuranceMember) => policies.data?.results.find((p) => p.id === m.policy)?.policy_no ?? "";
  const columns: Column<InsuranceMember>[] = [
    { id: "person", header: t("insurance.person"), cell: (m) => <span className="font-medium">{personName(m)}</span> },
    { id: "policy", header: t("insurance.policy"), cell: (m) => <span className="num" dir="ltr">{policyNo(m)}</span> },
    { id: "class", header: t("insurance.class"), cell: (m) => m.insurance_class },
    { id: "member", header: t("insurance.memberNo"), cell: (m) => <span className="num" dir="ltr">{m.member_no || "—"}</span> },
    { id: "covered", header: t("insurance.coverage"), cell: (m) => <Pill tone={m.covered_today ? "green" : "neutral"}>{m.covered_today ? t("insurance.covered") : t("insurance.notCovered")}</Pill> },
    {
      id: "card",
      header: <span className="sr-only">{t("insurance.card")}</span>,
      className: "w-24",
      cell: (m) => (
        <span className="flex gap-1">
          {m.has_file && <IconButton size="sm" variant="plain" icon={<Eye />} label={t("insurance.viewCard")} onClick={() => view.mutate(m)} />}
          {manage && <IconButton size="sm" variant="plain" icon={<Upload />} label={t("insurance.uploadCard")} onClick={() => setCard(m)} />}
        </span>
      ),
    },
  ];
  return (
    <Card
      variant="solid"
      title={t("insurance.title")}
      action={
        manage && policies.data?.results.length ? (
          <Button size="sm" variant="accent" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
            {t("insurance.add")}
          </Button>
        ) : undefined
      }
    >
      {(remove.isError || view.isError) && <Alert className="mb-3">{apiErrors(remove.error ?? view.error, t("common.saveFailed")).general}</Alert>}
      <DataTable
        caption={t("insurance.title")}
        columns={columns}
        rows={members.data ?? []}
        rowKey={(m) => String(m.id)}
        rowLabel={personName}
        loading={members.isPending}
        onDelete={manage ? (m) => remove.mutate(m) : undefined}
        minWidth={760}
        empty={t("insurance.none")}
      />
      {adding && policies.data && (
        <MemberDialog employee={employee} dependents={dependents.data ?? []} policies={policies.data.results} onClose={() => setAdding(false)} onSaved={refresh} />
      )}
      {card && (
        <UploadDialog
          title={t("insurance.uploadCard")}
          current={card.file_name}
          upload={async (file) => {
            await hr.updateMember(card.id, formData({ file }));
            await refresh();
          }}
          onClose={() => setCard(null)}
        />
      )}
    </Card>
  );
}

function MemberDialog({
  employee,
  dependents,
  policies,
  onClose,
  onSaved,
}: {
  employee: Employee;
  dependents: Dependent[];
  policies: { id: number; policy_no: string; provider_ar: string; provider_en: string; classes: string[]; start_date: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const [policy, setPolicy] = useState(String(policies[0]?.id ?? ""));
  const chosen = policies.find((p) => String(p.id) === policy);
  const [values, setValues] = useState({ dependent: "", insurance_class: chosen?.classes[0] ?? "", member_no: "", start_date: toISODate(new Date()) });
  const save = useMutation({
    mutationFn: () =>
      hr.createMember({
        employee: employee.id,
        policy: Number(policy),
        dependent: values.dependent ? Number(values.dependent) : null,
        insurance_class: values.insurance_class,
        member_no: values.member_no,
        start_date: values.start_date,
      }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("insurance.add")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={save.isPending || !values.insurance_class} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormSelect
          label={t("insurance.policy")}
          value={policy}
          onChange={(e) => setPolicy(e.target.value)}
          options={policies.map((p) => ({ value: String(p.id), label: `${format.pick({ ar: p.provider_ar, en: p.provider_en })} · ${p.policy_no}` }))}
          error={errors.fields.policy}
        />
        <FormSelect
          label={t("insurance.person")}
          value={values.dependent}
          onChange={(e) => setValues((v) => ({ ...v, dependent: e.target.value }))}
          options={[{ value: "", label: format.name(employee) }, ...dependents.map((d) => ({ value: String(d.id), label: format.name(d) }))]}
          error={errors.fields.dependent}
        />
        <FormSelect
          label={t("insurance.class")}
          value={values.insurance_class}
          onChange={(e) => setValues((v) => ({ ...v, insurance_class: e.target.value }))}
          options={(chosen?.classes ?? []).map((c) => ({ value: c, label: c }))}
          error={errors.fields.insurance_class}
        />
        <TextField label={t("insurance.memberNo")} dir="ltr" value={values.member_no} onChange={(e) => setValues((v) => ({ ...v, member_no: e.target.value }))} />
        <DateInput label={t("insurance.start")} value={values.start_date} onChange={(d) => setValues((v) => ({ ...v, start_date: d ?? "" }))} error={errors.fields.start_date} />
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
