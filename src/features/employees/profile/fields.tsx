import type { TFunction } from "i18next";

import type { Employee } from "@/api";
import { Money } from "@/design/Money";
import type { useFormat } from "@/lib/useFormat";
import { checkArabicName, checkEnglishName, checkIdNumber, checkSaudiIban, checkSaudiMobile, formatIban } from "@/lib/validators";

import type { MasterData } from "../masterData";
import type { FieldSpec } from "./EditableSection";

type Format = ReturnType<typeof useFormat>;

export const NAME_PARTS = ["first_name", "father_name", "grandfather_name", "family_name"] as const;
export const ID_TYPES = ["national_id", "iqama", "border_no"] as const;
export const GENDERS = ["male", "female"] as const;
export const MARITAL = ["single", "married", "divorced", "widowed"] as const;

const choices = (t: TFunction, prefix: string, values: readonly string[]) =>
  values.map((value) => ({ value, label: t(`${prefix}.${value}`) }));

const date = (format: Format, hijri = false) => (value: string | null | undefined) =>
  value ? (hijri ? `${format.date(value)} · ${format.hijri(value)}` : format.date(value)) : "";

export function nameFields(t: TFunction): FieldSpec[] {
  return [
    ...NAME_PARTS.map((part) => ({ name: `${part}_ar` as const, label: t(`employee.fields.${part}_ar`), check: checkArabicName })),
    ...NAME_PARTS.map((part) => ({
      name: `${part}_en` as const,
      label: t(`employee.fields.${part}_en`),
      check: checkEnglishName,
      ltr: true,
    })),
  ];
}

export function personalFields(t: TFunction, format: Format, master: MasterData): FieldSpec[] {
  return [
    { name: "id_type", label: t("employee.fields.id_type"), type: "select", options: choices(t, "employee.idType", ID_TYPES) },
    {
      name: "id_number",
      label: t("employee.fields.id_number"),
      ltr: true,
      check: (v) => checkIdNumber(v),
    },
    {
      name: "id_expiry",
      label: t("employee.fields.id_expiry"),
      type: "date",
      hijri: true,
      display: (e) => date(format, true)(e.id_expiry),
    },
    { name: "nationality", label: t("employee.fields.nationality"), type: "select", options: master.options.countries },
    { name: "gender", label: t("employee.fields.gender"), type: "select", options: choices(t, "employee.gender", GENDERS) },
    {
      name: "date_of_birth",
      label: t("employee.fields.date_of_birth"),
      type: "date",
      hijri: true,
      display: (e) => date(format, true)(e.date_of_birth),
    },
    { name: "marital_status", label: t("employee.fields.marital_status"), type: "select", options: choices(t, "employee.marital", MARITAL) },
    { name: "personal_email", label: t("employee.fields.personal_email"), type: "email" },
  ];
}

export function addressFields(t: TFunction): FieldSpec[] {
  return (["building_number", "street", "district", "postal_code", "additional_number"] as const).map((name) => ({
    name,
    label: t(`employee.fields.${name}`),
    ltr: ["building_number", "postal_code", "additional_number"].includes(name),
  }));
}

export function emergencyFields(t: TFunction): FieldSpec[] {
  return [
    { name: "emergency_contact_name", label: t("employee.fields.emergency_contact_name") },
    { name: "emergency_contact_phone", label: t("employee.fields.emergency_contact_phone"), type: "tel" },
    { name: "emergency_contact_relation", label: t("employee.fields.emergency_contact_relation") },
  ];
}

/** Job data: title, grade, department, branch and manager change through lifecycle actions (with history). */
export function jobFields(t: TFunction, format: Format, master: MasterData, managerName: string): FieldSpec[] {
  const actionHint = t("employee.useAction");
  return [
    { name: "employee_no", label: t("employee.fields.employee_no"), ltr: true },
    { name: "job_title", label: t("employee.fields.job_title"), readOnly: true, hint: actionHint, display: (e) => master.name.jobTitle(e.job_title) },
    { name: "grade", label: t("employee.fields.grade"), readOnly: true, display: (e) => master.name.grade(e.grade) },
    { name: "department", label: t("employee.fields.department"), readOnly: true, display: (e) => master.name.department(e.department) },
    { name: "branch", label: t("employee.fields.branch"), readOnly: true, display: (e) => master.name.branch(e.branch) },
    { name: "manager", label: t("employee.fields.manager"), readOnly: true, display: () => managerName },
    {
      name: "employment_type",
      label: t("employee.fields.employment_type"),
      type: "select",
      options: choices(t, "employee.employmentType", ["full_time", "part_time"]),
    },
    { name: "hire_date", label: t("employee.fields.hire_date"), readOnly: true, display: (e) => date(format)(e.hire_date) },
    { name: "probation_end", label: t("employee.fields.probation_end"), readOnly: true, display: (e) => date(format)(e.probation_end) },
    { name: "confirmation_date", label: t("employee.fields.confirmation_date"), readOnly: true, display: (e) => date(format)(e.confirmation_date) },
    { name: "termination_date", label: t("employee.fields.termination_date"), readOnly: true, display: (e) => date(format)(e.termination_date) },
    {
      name: "mobile",
      label: t("employee.fields.mobile"),
      type: "tel",
      check: (v) => (v.startsWith("+") && !v.startsWith("+966") ? { value: v, error: null } : checkSaudiMobile(v)),
    },
    { name: "work_email", label: t("employee.fields.work_email"), type: "email" },
  ];
}

const money = (value: string | null | undefined) => (value ? <Money amount={value} /> : "");

/** Salary changes of a hired employee go through a lifecycle action (it keeps the history); before hiring the
 * file holds the agreed package. */
export function salaryFields(t: TFunction, employee: Employee): FieldSpec[] {
  const readOnly = employee.status !== "pending";
  return (["basic_salary", "housing_allowance", "transport_allowance", "other_allowances"] as const).map((name) => ({
    name,
    label: t(`employee.fields.${name}`),
    type: "money",
    readOnly,
    display: (e: Employee) => money(e[name]),
  }));
}

export function bankFields(t: TFunction, master: MasterData): FieldSpec[] {
  return [
    {
      name: "iban",
      label: t("employee.fields.iban"),
      ltr: true,
      check: checkSaudiIban,
      display: (e) => (e.iban ? <span dir="ltr">{formatIban(e.iban)}</span> : ""),
      hint: t("employee.ibanHint"),
    },
    { name: "bank", label: t("employee.fields.bank"), readOnly: true, display: (e) => master.name.bank(e.bank) },
    { name: "account_holder_name", label: t("employee.fields.account_holder_name") },
  ];
}
