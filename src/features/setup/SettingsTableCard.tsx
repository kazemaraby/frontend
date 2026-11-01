import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { SettingsTableData, SettingsValue } from "@/api/payroll";
import { useScopeKey } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { FormSelect, TextField } from "@/design/Field";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

export type SettingsField = { name: string; kind: "number" | "decimal" | "choice" | "boolean"; options?: readonly string[] };

/** A settings table (apps.core.views.SettingsTableView): each value for the whole account, the active company's own
 * (empty = the account's) and what applies. `canAccount` / `canCompany` say which column the user may change. */
export function SettingsTableCard({ queryKey, load, save, fields, labels, title, hint, canAccount, canCompany }: {
  queryKey: string;
  load: () => Promise<SettingsTableData>;
  save: (level: "account" | "company", values: Record<string, SettingsValue>) => Promise<SettingsTableData>;
  fields: readonly SettingsField[];
  labels: string;
  title: string;
  hint: string;
  canAccount: boolean;
  canCompany: boolean;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const queryClient = useQueryClient();
  const data = useQuery({ queryKey: [queryKey, ...scope], queryFn: load });
  const [account, setAccount] = useState<Record<string, string>>({});
  const [company, setCompany] = useState<Record<string, string>>({});
  const kindOf = Object.fromEntries(fields.map((f) => [f.name, f.kind]));
  const parse = (name: string, raw: string): SettingsValue => {
    if (raw === "") return null;
    if (kindOf[name] === "boolean") return raw === "true";
    if (kindOf[name] === "number") return Number(raw);
    return raw; // decimals and choices stay text (never a float)
  };
  const mutation = useMutation({
    mutationFn: ({ level, draft }: { level: "account" | "company"; draft: Record<string, string> }) =>
      save(level, Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, parse(k, v)]))),
    onSuccess: async (_d, { level }) => {
      (level === "account" ? setAccount : setCompany)({});
      await queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
  });
  const errors = apiErrors(mutation.error, t("common.saveFailed"));
  const d = data.data;
  const shown = (field: SettingsField, value: SettingsValue) => {
    if (value === null || value === undefined) return "—";
    if (field.kind === "boolean") return t(value ? "common.yes" : "common.no");
    if (field.kind === "choice") return t(`${labels}.choices.${field.name}.${value}`);
    return format.number(Number(value), [0, 2]);
  };
  const input = (level: "account" | "company", field: SettingsField, label: string) => {
    const draft = level === "account" ? account : company;
    const change = level === "account" ? setAccount : setCompany;
    const stored = d?.[level][field.name];
    const value = draft[field.name] ?? (stored === null || stored === undefined ? "" : String(stored));
    const common = { label: `${label} · ${t(`attendanceSettings.hours.${level}`)}`, className: "[&_label]:sr-only", disabled: level === "account" ? !canAccount : !canCompany };
    const inherit = level === "company" ? t("attendanceSettings.rules.inherit") : undefined;
    if (field.kind === "boolean" || field.kind === "choice") {
      const options = field.kind === "boolean" ? [{ value: "true", label: t("common.yes") }, { value: "false", label: t("common.no") }] : (field.options ?? []).map((o) => ({ value: o, label: t(`${labels}.choices.${field.name}.${o}`) }));
      return <FormSelect {...common} value={value} placeholder={inherit} onChange={(e) => change((x) => ({ ...x, [field.name]: e.target.value }))} options={options} />;
    }
    return <TextField {...common} inputMode={field.kind === "decimal" ? "decimal" : "numeric"} dir="ltr" placeholder={level === "company" && d ? String(d.account[field.name] ?? "") : ""} value={value} onChange={(e) => change((x) => ({ ...x, [field.name]: e.target.value }))} error={mutation.variables?.level === level ? errors.fields[field.name] : undefined} />;
  };
  return (
    <Card
      variant="solid"
      title={title}
      subtitle={hint}
      action={
        <div className="flex gap-2">
          {canAccount && (
            <Button size="sm" variant="outline" disabled={!Object.keys(account).length || mutation.isPending} onClick={() => mutation.mutate({ level: "account", draft: account })}>
              {t("attendanceSettings.hours.saveAccount")}
            </Button>
          )}
          {canCompany && (
            <Button size="sm" disabled={!Object.keys(company).length || mutation.isPending} onClick={() => mutation.mutate({ level: "company", draft: company })}>
              {t("attendanceSettings.hours.saveCompany")}
            </Button>
          )}
        </div>
      }
    >
      {!d ? (
        <p className="text-muted">{data.isError ? t("common.loadFailed") : t("common.loading")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="text-muted">
                <th scope="col" className="py-2 text-start font-medium">{t("attendanceSettings.hours.rule")}</th>
                <th scope="col" className="py-2 text-start font-medium">{t("attendanceSettings.hours.account")}</th>
                <th scope="col" className="py-2 text-start font-medium">{t("attendanceSettings.hours.company")}</th>
                <th scope="col" className="py-2 text-start font-medium">{t("attendanceSettings.hours.applies")}</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => {
                const label = t(`${labels}.fields.${field.name}`);
                return (
                  <tr key={field.name} className="border-t border-line">
                    <th scope="row" className="py-2 pe-3 text-start font-medium text-ink">{label}</th>
                    <td className="w-44 py-2 pe-3">{input("account", field, label)}</td>
                    <td className="w-44 py-2 pe-3">{input("company", field, label)}</td>
                    <td className="num py-2 font-semibold text-ink">{shown(field, d.effective[field.name])}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {errors.general && mutation.error && <Alert className="mt-3">{errors.general}</Alert>}
    </Card>
  );
}
