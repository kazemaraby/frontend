import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { attendance } from "@/api/attendance";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { TextField } from "@/design/Field";
import { Pill } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

type Draft = Record<string, string>;
const text = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));

/** The Labor Law's numbers (LaborSettings, /labor-settings), each with its article and whether it was checked against
 * the official text. Only the account administrator (core.manage_companies) changes them; a company may override one.
 * Used by the attendance settings (working hours) and the payroll settings (deductions, end of service). */
export function LaborValuesCard({ fields, title, hint, labels, also = [] }: { fields: readonly string[]; title: string; hint: string; labels: string; also?: string[] }) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const { can } = useSession();
  const queryClient = useQueryClient();
  const data = useQuery({ queryKey: ["labor-settings", ...scope], queryFn: attendance.labor });
  const [account, setAccount] = useState<Draft>({});
  const [company, setCompany] = useState<Draft>({});
  const shared = can("core.manage_companies"); // the law's values: the account administrator changes them
  const save = useMutation({
    mutationFn: ({ level, draft }: { level: "account" | "company"; draft: Draft }) =>
      attendance.saveLabor(level, Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v?.trim() === "" ? null : v]))),
    onSuccess: async (_data, { level }) => {
      (level === "account" ? setAccount : setCompany)({});
      await queryClient.invalidateQueries({ queryKey: ["labor-settings"] });
      for (const key of also) await queryClient.invalidateQueries({ queryKey: [key] });
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const d = data.data;
  return (
    <Card
      variant="solid"
      title={title}
      subtitle={hint}
      action={
        <div className="flex gap-2">
          {shared && (
            <Button size="sm" variant="outline" disabled={!Object.keys(account).length || save.isPending} onClick={() => save.mutate({ level: "account", draft: account })}>
              {t("attendanceSettings.hours.saveAccount")}
            </Button>
          )}
          {shared && (
            <Button size="sm" disabled={!Object.keys(company).length || save.isPending} onClick={() => save.mutate({ level: "company", draft: company })}>
              {t("attendanceSettings.hours.saveCompany")}
            </Button>
          )}
        </div>
      }
    >
      {!d ? (
        <p className="text-muted">{t("common.loading")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="text-muted">
                <th scope="col" className="py-2 text-start font-medium">{t("attendanceSettings.hours.rule")}</th>
                <th scope="col" className="py-2 text-start font-medium">{t("attendanceSettings.hours.source")}</th>
                <th scope="col" className="py-2 text-start font-medium">{t("attendanceSettings.hours.account")}</th>
                <th scope="col" className="py-2 text-start font-medium">{t("attendanceSettings.hours.company")}</th>
                <th scope="col" className="py-2 text-start font-medium">{t("attendanceSettings.hours.applies")}</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((name) => {
                const source = d.sources[name];
                const label = t(`${labels}.${name}`);
                return (
                  <tr key={name} className="border-t border-line">
                    <th scope="row" className="py-2 pe-3 text-start font-medium text-ink">{label}</th>
                    <td className="py-2 pe-3">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="num whitespace-nowrap text-muted">{t(`attendanceSettings.hours.articles.${source.article}`, { defaultValue: source.article })}</span>
                        {source.status === "to_confirm" && <Pill tone="amber">{t("attendanceSettings.hours.toConfirm")}</Pill>}
                      </span>
                    </td>
                    <td className="w-32 py-2 pe-3">
                      <TextField label={`${label} · ${t("attendanceSettings.hours.account")}`} className="[&_label]:sr-only" inputMode="decimal" dir="ltr" disabled={!shared} value={account[name] ?? text(d.account[name])} onChange={(e) => setAccount((x) => ({ ...x, [name]: e.target.value }))} error={save.variables?.level === "account" ? errors.fields[name] : undefined} />
                    </td>
                    <td className="w-32 py-2 pe-3">
                      <TextField label={`${label} · ${t("attendanceSettings.hours.company")}`} className="[&_label]:sr-only" inputMode="decimal" dir="ltr" disabled={!shared} placeholder={text(d.account[name])} value={company[name] ?? text(d.company[name])} onChange={(e) => setCompany((x) => ({ ...x, [name]: e.target.value }))} error={save.variables?.level === "company" ? errors.fields[name] : undefined} />
                    </td>
                    <td className="num py-2 font-semibold text-ink">{format.number(Number(d.effective[name]), [0, 2])}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-sm text-muted">{t(shared ? "attendanceSettings.hours.companyHint" : "attendanceSettings.hours.readOnly")}</p>
        </div>
      )}
      {errors.general && save.error && <Alert className="mt-3">{errors.general}</Alert>}
    </Card>
  );
}
