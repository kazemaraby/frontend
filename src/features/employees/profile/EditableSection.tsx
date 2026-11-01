import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Employee } from "@/api";
import { hr } from "@/api/hr";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { DateInput } from "@/design/DateInput";
import { DetailList } from "@/design/DetailList";
import { FormSelect, TextField } from "@/design/Field";
import { apiErrors } from "@/lib/apiErrors";
import type { Checked } from "@/lib/validators";

export type FieldSpec = {
  name: keyof Employee & string;
  label: string;
  type?: "text" | "select" | "date" | "email" | "tel" | "money";
  options?: { value: string; label: string }[];
  /** Dates shown and enterable in Hijri as well (iqama, birth). */
  hijri?: boolean;
  /** Typed left-to-right even on an Arabic page (numbers, emails, IBAN). */
  ltr?: boolean;
  /** Client-side check mirrored from the backend; returns the normalised value or an error code. */
  check?: (value: string) => Checked;
  /** How the value reads in view mode (default: the raw value or the option label). */
  display?: (employee: Employee) => ReactNode;
  readOnly?: boolean;
  hint?: string;
  wide?: boolean;
};

type Props = {
  employee: Employee;
  title: string;
  fields: FieldSpec[];
  /** Permission code needed to edit (the API also checks the data scope and answers 403 otherwise). */
  canEdit: boolean;
  note?: ReactNode;
};

/** Foreign keys: emptied means null. Text and choice fields (gender, ID type…) empty to "". */
const NULLABLE = new Set(["nationality", "city", "bank", "manager", "job_title", "grade", "branch", "department"]);

const asText = (value: unknown) => (value === null || value === undefined ? "" : String(value));

/** A section of the employee file: read view, and an edit form for the fields the user may change. */
export function EditableSection({ employee, title, fields, canEdit, note }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [local, setLocal] = useState<Record<string, string>>({});

  const visible = fields.filter((f) => f.name in employee);
  const editable = visible.filter((f) => !f.readOnly);
  const start = () => {
    setValues(Object.fromEntries(editable.map((f) => [f.name, asText(employee[f.name])])));
    setLocal({});
    save.reset();
    setEditing(true);
  };

  const save = useMutation({
    mutationFn: (patch: Record<string, unknown>) => hr.updateEmployee(employee.id, patch as Partial<Employee>),
    onSuccess: (updated) => {
      // The update answer has no `access` (detail only): keep what the user may do on this employee.
      queryClient.setQueryData<Employee>(["employee", employee.id], (old) => ({ ...updated, access: old?.access }));
      void queryClient.invalidateQueries({ queryKey: ["employees"] });
      setEditing(false);
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));

  function submit() {
    const problems: Record<string, string> = {};
    const patch: Record<string, unknown> = {};
    for (const field of editable) {
      let value = values[field.name] ?? "";
      if (value && field.check) {
        const checked = field.check(value);
        if (checked.error) problems[field.name] = t(`validation.${checked.error}`);
        else value = checked.value;
      }
      if (value === asText(employee[field.name])) continue;
      const nullable = field.type === "date" || field.type === "money" || NULLABLE.has(field.name);
      patch[field.name] = value === "" && nullable ? null : value;
    }
    setLocal(problems);
    if (Object.keys(problems).length) return;
    if (!Object.keys(patch).length) return setEditing(false);
    save.mutate(patch);
  }

  const set = (name: string) => (value: string) => setValues((v) => ({ ...v, [name]: value }));
  const errorOf = (name: string) => local[name] ?? errors.fields[name] ?? errors.fields[`${name}_hijri`];

  if (!visible.length) return null;
  return (
    <Card
      variant="solid"
      title={title}
      action={
        canEdit && editable.length > 0 && !editing ? (
          <Button size="sm" variant="outline" icon={<Pencil className="size-4" />} onClick={start}>
            {t("common.edit")}
          </Button>
        ) : undefined
      }
    >
      {note && !editing && <div className="mb-4">{note}</div>}
      {!editing ? (
        <DetailList
          items={visible.map((f) => ({
            label: f.label,
            wide: f.wide,
            value: f.display
              ? f.display(employee)
              : f.options
                ? f.options.find((o) => o.value === asText(employee[f.name]))?.label
                : asText(employee[f.name]),
          }))}
        />
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          noValidate
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {editable.map((f) => {
              const common = { label: f.label, error: errorOf(f.name), hint: f.hint };
              if (f.type === "select") {
                return (
                  <FormSelect
                    key={f.name}
                    {...common}
                    name={f.name}
                    value={values[f.name] ?? ""}
                    onChange={(e) => set(f.name)(e.target.value)}
                    options={f.options ?? []}
                    placeholder={t("common.choose")}
                  />
                );
              }
              if (f.type === "date") {
                return (
                  <DateInput
                    key={f.name}
                    {...common}
                    name={f.name}
                    hijri={f.hijri}
                    value={values[f.name] || null}
                    onChange={(iso) => set(f.name)(iso ?? "")}
                  />
                );
              }
              return (
                <TextField
                  key={f.name}
                  {...common}
                  name={f.name}
                  type={f.type === "email" ? "email" : f.type === "tel" ? "tel" : "text"}
                  inputMode={f.type === "money" ? "decimal" : undefined}
                  dir={f.ltr || f.type === "money" || f.type === "email" || f.type === "tel" ? "ltr" : undefined}
                  value={values[f.name] ?? ""}
                  onChange={(e) => set(f.name)(e.target.value)}
                  className={f.wide ? "sm:col-span-2" : undefined}
                />
              );
            })}
          </div>
          {errors.general && <Alert className="mt-4">{errors.general}</Alert>}
          <div className="mt-5 flex justify-end gap-2.5">
            <Button variant="outline" onClick={() => setEditing(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
