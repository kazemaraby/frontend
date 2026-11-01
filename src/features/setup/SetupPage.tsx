import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, FileUp, Plus, UserPlus } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router";

import { type Company, formData, hr } from "@/api/hr";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { cn } from "@/design/cn";
import { type Column, DataTable } from "@/design/DataTable";
import { CheckField, FormSelect, TextField } from "@/design/Field";
import { FileDrop } from "@/design/FileDrop";
import { Pill } from "@/design/Pill";
import { Page } from "@/layout/Page";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";
import { checkArabicName } from "@/lib/validators";

const STEPS = ["company", "branches", "departments", "employees"] as const;
type Step = (typeof STEPS)[number];
const LEGAL = ["cr_number", "unified_number", "vat_number", "gosi_number", "mhrsd_establishment_no", "mudad_id"] as const;

/** /settings — client setup (#15): the active company (legal identifiers and logo), its branches, its departments,
 * then employees (one by one or the Excel import). The leave policy step arrives with the leave module (Phase 2). */
export default function SetupPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const step: Step = STEPS.includes(params.get("step") as Step) ? (params.get("step") as Step) : "company";
  const index = STEPS.indexOf(step);
  const go = (s: Step) => setParams(s === "company" ? {} : { step: s });
  return (
    <Page title={t("setup.title")}>
      <div className="flex flex-col gap-4">
        <ol className="flex flex-wrap gap-2" aria-label={t("setup.steps")}>
          {STEPS.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                aria-current={s === step ? "step" : undefined}
                onClick={() => go(s)}
                className={cn(
                  "num flex h-9 cursor-pointer items-center gap-2 rounded-full px-4 text-sm",
                  s === step ? "bg-navy text-white" : i < index ? "bg-teal-soft text-teal-ink" : "border border-line-strong bg-white text-ink",
                )}
              >
                {i < index ? <Check aria-hidden="true" className="size-4" /> : <span>{i + 1}</span>}
                {t(`setup.stepNames.${s}`)}
              </button>
            </li>
          ))}
          <li>
            <span className="flex h-9 items-center gap-2 rounded-full border border-dashed border-line-strong px-4 text-sm text-muted">
              {t("setup.leaveLater")}
            </span>
          </li>
        </ol>
        {step === "company" && <CompanyStep />}
        {step === "branches" && <BranchesStep />}
        {step === "departments" && <DepartmentsStep />}
        {step === "employees" && <EmployeesStep />}
        <div className="flex justify-between">
          <Button variant="outline" disabled={index === 0} onClick={() => go(STEPS[index - 1])}>
            {t("common.previous")}
          </Button>
          {index < STEPS.length - 1 && <Button onClick={() => go(STEPS[index + 1])}>{t("common.next")}</Button>}
        </div>
      </div>
    </Page>
  );
}

function CompanyStep() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { company: active, retry } = useSession();
  const companies = useQuery({ queryKey: ["setup", "companies"], queryFn: hr.companies });
  const company = companies.data?.results.find((c) => c.id === active?.id);
  const [values, setValues] = useState<Partial<Record<keyof Company, string>>>({});
  const [logo, setLogo] = useState<File | null>(null);
  const value = (key: keyof Company) => values[key] ?? String(company?.[key] ?? "");
  const save = useMutation({
    mutationFn: async () => {
      if (!company) return;
      const changed = Object.fromEntries(Object.entries(values).filter(([k, v]) => v !== String(company[k as keyof Company] ?? "")));
      await hr.updateCompany(company.id, formData({ ...changed, ...(logo ? { logo } : {}) }));
    },
    onSuccess: async () => {
      setValues({});
      setLogo(null);
      await queryClient.invalidateQueries({ queryKey: ["setup"] });
      retry(); // reload /me: the new name and logo appear in the company switcher
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const field = (key: keyof Company, props: Partial<Parameters<typeof TextField>[0]> = {}) => (
    <TextField
      key={key}
      label={t(`setup.company.${key}`)}
      name={key}
      value={value(key)}
      onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
      error={errors.fields[key]}
      {...props}
    />
  );
  if (!company) return <Card variant="solid">{companies.isPending ? t("common.loading") : <Alert>{t("common.loadFailed")}</Alert>}</Card>;
  return (
    <Card variant="solid" title={t("setup.stepNames.company")} subtitle={t("setup.companyNote")}>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          save.mutate();
        }}
        className="flex flex-col gap-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {field("name_ar")}
          {field("name_en", { dir: "ltr" })}
          {LEGAL.map((key) => field(key, { dir: "ltr", inputMode: "numeric" }))}
          {field("address_ar", { className: "sm:col-span-2" })}
        </div>
        <div className="flex flex-wrap items-end gap-4">
          {company.logo && <img src={company.logo} alt={t("setup.currentLogo")} className="size-16 rounded-tile bg-white object-contain ring-1 ring-line" />}
          <FileDrop
            label={t("setup.company.logo")}
            file={logo}
            onChange={setLogo}
            accept=".png,.jpg,.jpeg,.webp"
            check={async (f) => (/\.(png|jpe?g|webp)$/i.test(f.name) ? (f.size > 2 * 1024 * 1024 ? "file_size" : null) : "file_type")}
            limits={t("setup.logoLimits")}
            error={errors.fields.logo}
            className="min-w-72 flex-1"
          />
        </div>
        {errors.general && <Alert>{errors.general}</Alert>}
        {save.isSuccess && <Alert tone="info">{t("setup.saved")}</Alert>}
        <div className="flex justify-end">
          <Button type="submit" disabled={save.isPending}>
            {t("common.save")}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function BranchesStep() {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const scopeKey = useScopeKey();
  const { retry } = useSession();
  const branches = useQuery({ queryKey: ["setup", "branches", ...scopeKey], queryFn: hr.branches });
  const [values, setValues] = useState({ name_ar: "", name_en: "", code: "", establishment_no: "", is_main: false });
  const add = useMutation({
    mutationFn: () => hr.createBranch({ ...values, country: "SA" }),
    onSuccess: async () => {
      setValues({ name_ar: "", name_en: "", code: "", establishment_no: "", is_main: false });
      await queryClient.invalidateQueries({ queryKey: ["setup", "branches"] });
      retry(); // the switcher lists branches
    },
  });
  const errors = apiErrors(add.error, t("common.saveFailed"));
  const rows = branches.data?.results ?? [];
  type Row = (typeof rows)[number];
  const columns: Column<Row>[] = [
    { id: "name", header: t("setup.branch.name"), cell: (b) => <span className="font-medium">{format.name(b)}</span> },
    { id: "code", header: t("setup.branch.code"), cell: (b) => <span className="num">{b.code || "—"}</span> },
    { id: "establishment", header: t("setup.branch.establishment_no"), cell: (b) => <span className="num">{b.establishment_no || "—"}</span> },
    { id: "main", header: "", cell: (b) => (b.is_main ? <Pill tone="teal">{t("setup.branch.main")}</Pill> : null) },
  ];
  return (
    <Card variant="solid" title={t("setup.stepNames.branches")} subtitle={t("setup.branchesNote")}>
      <DataTable caption={t("setup.stepNames.branches")} columns={columns} rows={rows} rowKey={(b) => String(b.id)} loading={branches.isPending} minWidth={560} />
      <form
        className="mt-4 grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <TextField label={t("setup.branch.name_ar")} value={values.name_ar} onChange={(e) => setValues((v) => ({ ...v, name_ar: e.target.value }))} error={errors.fields.name_ar} />
        <TextField label={t("setup.branch.name_en")} dir="ltr" value={values.name_en} onChange={(e) => setValues((v) => ({ ...v, name_en: e.target.value }))} error={errors.fields.name_en} />
        <TextField label={t("setup.branch.code")} dir="ltr" value={values.code} onChange={(e) => setValues((v) => ({ ...v, code: e.target.value }))} error={errors.fields.code} />
        <TextField label={t("setup.branch.establishment_no")} dir="ltr" value={values.establishment_no} onChange={(e) => setValues((v) => ({ ...v, establishment_no: e.target.value }))} />
        <Button type="submit" variant="accent" icon={<Plus className="size-4" />} disabled={!values.name_ar.trim() || add.isPending}>
          {t("setup.add")}
        </Button>
        <CheckField label={t("setup.branch.main")} checked={values.is_main} onChange={(e) => setValues((v) => ({ ...v, is_main: e.target.checked }))} />
      </form>
      {(errors.general || errors.fields.is_main) && <Alert className="mt-3">{errors.fields.is_main ?? errors.general}</Alert>}
    </Card>
  );
}

function DepartmentsStep() {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const scopeKey = useScopeKey();
  const departments = useQuery({ queryKey: ["setup", "departments", ...scopeKey], queryFn: hr.departmentRows });
  const branches = useQuery({ queryKey: ["setup", "branches", ...scopeKey], queryFn: hr.branches });
  const [values, setValues] = useState({ name_ar: "", name_en: "", code: "", parent: "", branch: "" });
  const [local, setLocal] = useState<string | null>(null);
  const add = useMutation({
    mutationFn: () =>
      hr.createDepartment({
        name_ar: values.name_ar,
        name_en: values.name_en,
        code: values.code,
        parent: values.parent ? Number(values.parent) : null,
        branch: values.branch ? Number(values.branch) : null,
      }),
    onSuccess: async () => {
      setValues({ name_ar: "", name_en: "", code: "", parent: "", branch: "" });
      await queryClient.invalidateQueries({ queryKey: ["setup", "departments"] });
      await queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
  });
  const people = useQuery({ queryKey: ["setup", "people", ...scopeKey], queryFn: hr.employeeChoices });
  const setHead = useMutation({
    mutationFn: ({ id, manager }: { id: number; manager: number | null }) => hr.updateDepartment(id, { manager }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["setup", "departments"] }),
  });
  const errors = apiErrors(add.error ?? setHead.error, t("common.saveFailed"));
  const rows = departments.data?.results ?? [];
  const names = new Map(rows.map((d) => [d.id, format.name(d)]));
  const headOptions = (people.data?.results ?? []).map((e) => ({ value: String(e.id), label: `${format.name(e)} · ${e.employee_no}` }));
  const branchNames = new Map((branches.data?.results ?? []).map((b) => [b.id, format.name(b)]));
  type Row = (typeof rows)[number];
  const columns: Column<Row>[] = [
    { id: "name", header: t("setup.department.name"), cell: (d) => <span className="font-medium">{format.name(d)}</span> },
    { id: "parent", header: t("setup.department.parent"), cell: (d) => (d.parent ? names.get(d.parent) : "—") },
    { id: "branch", header: t("setup.department.branch"), cell: (d) => (d.branch ? branchNames.get(d.branch) : "—") },
    { id: "code", header: t("setup.department.code"), cell: (d) => <span className="num">{d.code || "—"}</span> },
    {
      id: "head",
      header: t("setup.department.head"),
      className: "w-72",
      cell: (d) => (
        <FormSelect
          label={t("setup.department.headOf", { name: format.name(d) })}
          className="[&_label]:sr-only"
          value={d.manager ? String(d.manager) : ""}
          onChange={(e) => setHead.mutate({ id: d.id, manager: e.target.value ? Number(e.target.value) : null })}
          placeholder={t("setup.department.noHead")}
          options={headOptions}
        />
      ),
    },
  ];
  return (
    <Card variant="solid" title={t("setup.stepNames.departments")} subtitle={t("setup.departmentsNote")}>
      <DataTable caption={t("setup.stepNames.departments")} columns={columns} rows={rows} rowKey={(d) => String(d.id)} loading={departments.isPending} minWidth={560} />
      <form
        className="mt-4 grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          const checked = checkArabicName(values.name_ar);
          setLocal(checked.error ? t(`validation.${checked.error}`) : null);
          if (!checked.error) add.mutate();
        }}
      >
        <TextField label={t("setup.department.name_ar")} value={values.name_ar} onChange={(e) => setValues((v) => ({ ...v, name_ar: e.target.value }))} error={local ?? errors.fields.name_ar} />
        <TextField label={t("setup.department.name_en")} dir="ltr" value={values.name_en} onChange={(e) => setValues((v) => ({ ...v, name_en: e.target.value }))} />
        <TextField label={t("setup.department.code")} dir="ltr" value={values.code} onChange={(e) => setValues((v) => ({ ...v, code: e.target.value }))} />
        <FormSelect
          label={t("setup.department.parent")}
          value={values.parent}
          onChange={(e) => setValues((v) => ({ ...v, parent: e.target.value }))}
          placeholder={t("setup.department.topLevel")}
          options={rows.map((d) => ({ value: String(d.id), label: format.name(d) }))}
          error={errors.fields.parent}
        />
        <FormSelect
          label={t("setup.department.branch")}
          value={values.branch}
          onChange={(e) => setValues((v) => ({ ...v, branch: e.target.value }))}
          placeholder={t("setup.department.allBranches")}
          options={(branches.data?.results ?? []).map((b) => ({ value: String(b.id), label: format.name(b) }))}
        />
        <Button type="submit" variant="accent" icon={<Plus className="size-4" />} disabled={!values.name_ar.trim() || add.isPending}>
          {t("setup.add")}
        </Button>
      </form>
      {errors.general && <Alert className="mt-3">{errors.general}</Alert>}
    </Card>
  );
}

function EmployeesStep() {
  const { t } = useTranslation();
  const { can } = useSession();
  const navigate = useNavigate();
  return (
    <Card variant="solid" title={t("setup.stepNames.employees")} subtitle={t("setup.employeesNote")}>
      <div className="flex flex-wrap gap-3">
        {can("employees.import") && (
          <Button variant="accent" icon={<FileUp className="size-[18px]" />} onClick={() => navigate("/employees/import")}>
            {t("setup.importEmployees")}
          </Button>
        )}
        {can("employees.create") && (
          <Button variant="outline" icon={<UserPlus className="size-[18px]" />} onClick={() => navigate("/employees/new")}>
            {t("employees.add")}
          </Button>
        )}
      </div>
    </Card>
  );
}
