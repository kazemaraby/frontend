import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import type { Employee } from "@/api";
import { hr } from "@/api/hr";
import { useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { cn } from "@/design/cn";
import { DateInput } from "@/design/DateInput";
import { DetailList } from "@/design/DetailList";
import { CheckField, FormSelect, TextField } from "@/design/Field";
import { Money } from "@/design/Money";
import { Page } from "@/layout/Page";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";
import {
  checkArabicName,
  checkEnglishName,
  checkIdNumber,
  checkSaudiIban,
  checkSaudiMobile,
  type IdType,
} from "@/lib/validators";

import { documentForm, type DocumentDraft, DocumentFields, emptyDocument } from "./dialogs/DocumentDialog";
import { useMasterData } from "./masterData";
import { GENDERS, ID_TYPES, NAME_PARTS } from "./profile/fields";

type Step = "identity" | "job" | "pay" | "documents" | "review";
type Values = Record<string, string>;

const IDENTITY = [...NAME_PARTS.flatMap((p) => [`${p}_ar`, `${p}_en`]), "id_type", "id_number", "nationality", "gender", "date_of_birth", "mobile", "work_email"];
const JOB = ["branch", "department", "job_title", "grade", "manager", "employment_type", "contract_type", "start_date", "end_date", "probation_days"];
const PAY = ["basic_salary", "housing_allowance", "transport_allowance", "other_allowances", "iban", "account_holder_name"];
const EMPLOYEE_FIELDS = new Set([...IDENTITY, ...JOB.slice(0, 6), ...PAY]);

/** /employees/new — step by step: identity → job and contract → salary and bank → documents → review.
 * Saving creates the employee (pending) and a draft contract; "hire now" also signs the contract and hires. */
export default function NewEmployeePage() {
  const { t } = useTranslation();
  const format = useFormat();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useSession();
  const master = useMasterData();
  const [values, setValues] = useState<Values>({ employment_type: "full_time" });
  const [documents, setDocuments] = useState<DocumentDraft[]>([]);
  const [hireNow, setHireNow] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [created, setCreated] = useState<Employee | null>(null);
  // Steps already done, so "create" after a partial failure carries on instead of repeating them.
  const [done, setDone] = useState<{ contract?: number; signed?: boolean; hired?: boolean; uploaded: number }>({ uploaded: 0 });
  const [saving, setSaving] = useState(false);
  const managers = useQuery({ queryKey: ["employees", "managers"], queryFn: () => hr.searchEmployees("") });

  const steps: Step[] = [
    "identity",
    "job",
    ...(can("employees.change_salary") || can("employees.change_bank") ? (["pay"] as const) : []),
    ...(can("employees.manage_documents") ? (["documents"] as const) : []),
    "review",
  ];
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const set = (name: string) => (value: string | null) => setValues((v) => ({ ...v, [name]: value ?? "" }));
  const contractType = master.contractTypes.find((c) => String(c.id) === values.contract_type);
  const canHire = can("employees.manage_contracts") && can("employees.change_status");

  /** Client-side checks of one step (the backend checks everything again). */
  function check(which: Step): Record<string, string> {
    const e: Record<string, string> = {};
    const need = (name: string) => {
      if (!values[name]?.trim()) e[name] = t("validation.required");
    };
    if (which === "identity") {
      need("first_name_ar");
      for (const part of NAME_PARTS) {
        const ar = checkArabicName(values[`${part}_ar`] ?? "");
        if (ar.error) e[`${part}_ar`] = t(`validation.${ar.error}`);
        const en = checkEnglishName(values[`${part}_en`] ?? "");
        if (en.error) e[`${part}_en`] = t(`validation.${en.error}`);
      }
      if (values.id_number) {
        if (!values.id_type) e.id_type = t("validation.required");
        const id = checkIdNumber(values.id_number, values.id_type as IdType);
        if (id.error) e.id_number = t(`validation.${id.error}`);
      }
      if (values.mobile && checkSaudiMobile(values.mobile).error && !values.mobile.startsWith("+")) {
        e.mobile = t("validation.saudi_mobile");
      }
    }
    if (which === "job") {
      need("contract_type");
      need("start_date");
      if (contractType?.has_end_date) need("end_date");
    }
    if (which === "pay" && values.iban) {
      const iban = checkSaudiIban(values.iban);
      if (iban.error) e.iban = t(`validation.${iban.error}`);
    }
    return e;
  }

  function next() {
    const problems = check(step);
    setErrors(problems);
    if (!Object.keys(problems).length) setIndex((i) => Math.min(i + 1, steps.length - 1));
  }

  async function save() {
    setSaving(true);
    setGeneral(null);
    let employee = created;
    try {
      if (!employee) {
        const body: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(values)) {
          if (!EMPLOYEE_FIELDS.has(key) || value === "") continue;
          body[key] = ["branch", "department", "job_title", "grade", "manager"].includes(key) ? Number(value) : value;
        }
        if (values.id_number) body.id_number = checkIdNumber(values.id_number).value;
        if (values.mobile) body.mobile = checkSaudiMobile(values.mobile).error ? values.mobile : checkSaudiMobile(values.mobile).value;
        if (values.iban) body.iban = checkSaudiIban(values.iban).value;
        employee = await hr.createEmployee(body as Partial<Employee>);
        setCreated(employee);
      }
      const progress = { ...done };
      try {
        if (!progress.contract) {
          const contract = await hr.createContract({
            employee: employee.id,
            contract_type: Number(values.contract_type),
            start_date: values.start_date,
            end_date: values.end_date || null,
            probation_days: Number(values.probation_days || 0),
            ...(can("employees.change_salary")
              ? Object.fromEntries(PAY.slice(0, 4).filter((f) => values[f]).map((f) => [f, values[f]]))
              : {}),
          });
          progress.contract = contract.id;
        }
        if (hireNow && canHire && !progress.signed) {
          await hr.activateContract(progress.contract);
          progress.signed = true;
        }
        if (hireNow && canHire && !progress.hired) {
          await hr.changeStatus(employee.id, { to: "hired", hire_date: values.start_date });
          progress.hired = true;
        }
        const drafts = documents.filter((d) => d.document_type);
        for (const draft of drafts.slice(progress.uploaded)) {
          await hr.uploadDocument(documentForm(employee.id, draft));
          progress.uploaded += 1;
        }
      } finally {
        setDone(progress);
      }
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      navigate(`/employees/${employee.id}`);
    } catch (error) {
      const found = apiErrors(error, t("common.saveFailed"));
      setErrors(found.fields);
      setGeneral(found.general ?? (employee ? t("wizard.partlySaved") : t("wizard.fixErrors")));
      if (!employee) {
        const first = steps.findIndex((s) => Object.keys(found.fields).some((f) => fieldStep(f) === s));
        if (first >= 0) setIndex(first);
      }
    } finally {
      setSaving(false);
    }
  }

  const field = (name: string, label: string, props: Partial<Parameters<typeof TextField>[0]> = {}) => (
    <TextField key={name} label={label} name={name} value={values[name] ?? ""} onChange={(e) => set(name)(e.target.value)} error={errors[name]} {...props} />
  );
  const managerOptions = (managers.data?.results ?? []).map((e) => ({ value: String(e.id), label: `${format.name(e)} · ${e.employee_no}` }));

  return (
    <Page title={t("wizard.title")}>
      <Card>
        <ol className="mb-6 flex flex-wrap gap-2" aria-label={t("wizard.steps")}>
          {steps.map((s, i) => (
            <li
              key={s}
              aria-current={i === index ? "step" : undefined}
              className={cn(
                "num flex h-9 items-center gap-2 rounded-full px-4 text-sm",
                i === index ? "bg-navy text-white" : i < index ? "bg-teal-soft text-teal-ink" : "border border-line-strong bg-white text-muted",
              )}
            >
              {i < index ? <Check className="size-4" aria-hidden="true" /> : <span>{format.number(i + 1)}</span>}
              {t(`wizard.stepNames.${s}`)}
            </li>
          ))}
        </ol>

        <Card variant="solid" title={t(`wizard.stepNames.${step}`)}>
          {step === "identity" && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {NAME_PARTS.map((p) => field(`${p}_ar`, t(`employee.fields.${p}_ar`), { required: p === "first_name" }))}
              {NAME_PARTS.map((p) => field(`${p}_en`, t(`employee.fields.${p}_en`), { dir: "ltr" }))}
              <FormSelect label={t("employee.fields.nationality")} name="nationality" value={values.nationality ?? ""} onChange={(e) => set("nationality")(e.target.value)} placeholder={t("common.choose")} options={master.options.countries} error={errors.nationality} />
              <FormSelect label={t("employee.fields.id_type")} name="id_type" value={values.id_type ?? ""} onChange={(e) => set("id_type")(e.target.value)} placeholder={t("common.choose")} options={ID_TYPES.map((x) => ({ value: x, label: t(`employee.idType.${x}`) }))} error={errors.id_type} />
              {field("id_number", t("employee.fields.id_number"), { dir: "ltr", inputMode: "numeric" })}
              <FormSelect label={t("employee.fields.gender")} name="gender" value={values.gender ?? ""} onChange={(e) => set("gender")(e.target.value)} placeholder={t("common.choose")} options={GENDERS.map((g) => ({ value: g, label: t(`employee.gender.${g}`) }))} error={errors.gender} />
              <DateInput label={t("employee.fields.date_of_birth")} name="date_of_birth" value={values.date_of_birth || null} onChange={set("date_of_birth")} hijri error={errors.date_of_birth} />
              {field("mobile", t("employee.fields.mobile"), { dir: "ltr", type: "tel", placeholder: "05XXXXXXXX" })}
              {field("work_email", t("employee.fields.work_email"), { dir: "ltr", type: "email", className: "sm:col-span-2" })}
            </div>
          )}

          {step === "job" && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormSelect label={t("employee.fields.branch")} name="branch" value={values.branch ?? ""} onChange={(e) => set("branch")(e.target.value)} placeholder={t("common.choose")} options={master.options.branches} error={errors.branch} />
              <FormSelect label={t("employee.fields.department")} name="department" value={values.department ?? ""} onChange={(e) => set("department")(e.target.value)} placeholder={t("common.choose")} options={master.options.departments} error={errors.department} />
              <FormSelect label={t("employee.fields.job_title")} name="job_title" value={values.job_title ?? ""} onChange={(e) => set("job_title")(e.target.value)} placeholder={t("common.choose")} options={master.options.jobTitles} error={errors.job_title} />
              <FormSelect label={t("employee.fields.grade")} name="grade" value={values.grade ?? ""} onChange={(e) => set("grade")(e.target.value)} placeholder={t("common.choose")} options={master.options.grades} error={errors.grade} />
              <FormSelect label={t("employee.fields.manager")} name="manager" value={values.manager ?? ""} onChange={(e) => set("manager")(e.target.value)} placeholder={t("common.choose")} options={managerOptions} error={errors.manager} />
              <FormSelect
                label={t("employee.fields.employment_type")}
                value={values.employment_type}
                onChange={(e) => set("employment_type")(e.target.value)}
                options={["full_time", "part_time"].map((v) => ({ value: v, label: t(`employee.employmentType.${v}`) }))}
              />
              <FormSelect label={t("contracts.type")} name="contract_type" value={values.contract_type ?? ""} onChange={(e) => set("contract_type")(e.target.value)} placeholder={t("common.choose")} options={master.options.contractTypes} error={errors.contract_type} />
              <DateInput label={t("wizard.startDate")} name="start_date" value={values.start_date || null} onChange={set("start_date")} hijri error={errors.start_date ?? errors.hire_date} />
              {contractType?.has_end_date !== false && (
                <DateInput label={t("contracts.end")} name="end_date" value={values.end_date || null} onChange={set("end_date")} hijri error={errors.end_date} />
              )}
              {field("probation_days", t("contracts.probationDays"), { dir: "ltr", inputMode: "numeric", hint: t("contracts.probationHint") })}
            </div>
          )}

          {step === "pay" && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {can("employees.change_salary") &&
                PAY.slice(0, 4).map((f) => field(f, t(`employee.fields.${f}`), { dir: "ltr", inputMode: "decimal" }))}
              {can("employees.change_bank") && (
                <>
                  {field("iban", t("employee.fields.iban"), { dir: "ltr", className: "sm:col-span-2", hint: t("employee.ibanHint") })}
                  {field("account_holder_name", t("employee.fields.account_holder_name"), { className: "sm:col-span-2" })}
                </>
              )}
            </div>
          )}

          {step === "documents" && (
            <div className="flex flex-col gap-6">
              {documents.length === 0 && <p className="text-muted">{t("wizard.noDocuments")}</p>}
              {documents.map((draft, i) => (
                <div key={i} className="rounded-tile border border-line p-4">
                  <DocumentFields draft={draft} onChange={(d) => setDocuments((all) => all.map((x, j) => (j === i ? d : x)))} types={master.documentTypes} />
                  <div className="mt-3 flex justify-end">
                    <Button size="sm" variant="ghost" onClick={() => setDocuments((all) => all.filter((_, j) => j !== i))}>
                      {t("common.delete")}
                    </Button>
                  </div>
                </div>
              ))}
              <div>
                <Button variant="outline" icon={<Plus className="size-4" />} onClick={() => setDocuments((all) => [...all, emptyDocument()])}>
                  {t("wizard.addDocument")}
                </Button>
              </div>
            </div>
          )}

          {step === "review" && (
            <div className="flex flex-col gap-5">
              <DetailList
                items={[
                  { label: t("wizard.name"), value: [values.first_name_ar, values.father_name_ar, values.grandfather_name_ar, values.family_name_ar].filter(Boolean).join(" ") },
                  { label: t("employee.fields.id_number"), value: values.id_number },
                  { label: t("employee.fields.nationality"), value: master.name.country(values.nationality) },
                  { label: t("employee.fields.job_title"), value: master.name.jobTitle(values.job_title) },
                  { label: t("employee.fields.department"), value: master.name.department(values.department) },
                  { label: t("contracts.type"), value: master.name.contractType(values.contract_type) },
                  { label: t("wizard.startDate"), value: values.start_date ? format.date(values.start_date) : "" },
                  { label: t("employee.fields.basic_salary"), value: values.basic_salary ? <Money amount={values.basic_salary} /> : "" },
                  { label: t("wizard.documents"), value: format.number(documents.filter((d) => d.document_type).length) },
                ]}
              />
              {canHire && <CheckField label={t("wizard.hireNow")} checked={hireNow} onChange={(e) => setHireNow(e.target.checked)} />}
            </div>
          )}

          {general && (
            <Alert className="mt-5">
              {general}
              {created && (
                <>
                  {" "}
                  <Link to={`/employees/${created.id}`} className="font-semibold underline">
                    {t("wizard.openFile")}
                  </Link>
                </>
              )}
            </Alert>
          )}
          <div className="mt-6 flex justify-between gap-2.5">
            <Button variant="outline" disabled={index === 0 || saving} onClick={() => setIndex((i) => i - 1)}>
              {t("common.previous")}
            </Button>
            {step === "review" ? (
              <Button variant="accent" disabled={saving} onClick={save}>
                {saving ? t("common.saving") : t("wizard.create")}
              </Button>
            ) : (
              <Button onClick={next}>{t("common.next")}</Button>
            )}
          </div>
        </Card>
      </Card>
    </Page>
  );
}

function fieldStep(field: string): Step {
  if (IDENTITY.includes(field)) return "identity";
  if (PAY.includes(field) || field === "bank") return "pay";
  return "job";
}
