import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { Employee } from "@/api";
import { eosb, type EosbQuery } from "@/api/payroll";
import { Alert } from "@/design/Alert";
import { Card } from "@/design/Card";
import { CheckField, FormSelect, TextField } from "@/design/Field";
import { Money } from "@/design/Money";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

const REASONS = ["resignation", "termination_by_employer", "mutual_agreement", "contract_ended", "retirement", "death", "dismissal", "probation_not_passed", "other"];

/** The end-of-service award (Phase 4 task 17, #92) in the employee's salary tab: by default the planned last day and
 * the leaving reason on file; HR may try another day or reason, Art. 87's cases (marriage, childbirth, force
 * majeure), Art. 77 (unfair termination) and the notice not served (Art. 76). Shows the service, the last wage, the
 * award with its fraction and article, and each step of the calculation. */
export function EosbCard({ employee }: { employee: Employee }) {
  const { t } = useTranslation();
  const format = useFormat();
  const [q, setQ] = useState<EosbQuery>({});
  const result = useQuery({ queryKey: ["eosb", employee.id, q], queryFn: () => eosb.of(employee.id, q), placeholderData: (previous) => previous });
  const data = result.data;
  const reason = q.reason ?? data?.reason ?? "resignation";
  const errors = apiErrors(result.error, t("common.loadFailed"));
  return (
    <Card variant="solid" title={t("eosb.title")} subtitle={t("eosb.hint")}>
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label={t("eosb.lastDay")} name="last_day" type="date" value={q.last_day ?? data?.last_day ?? ""} onChange={(e) => setQ({ ...q, last_day: e.target.value || undefined })} error={errors.fields.last_day} />
          <FormSelect label={t("eosb.reason")} name="reason" value={reason} onChange={(e) => setQ({ ...q, reason: e.target.value })} options={REASONS.map((r) => ({ value: r, label: t(`eosb.reasons.${r}`) }))} />
          {reason === "resignation" && (
            <FormSelect
              label={t("eosb.fullAward")}
              name="full_award"
              value={q.full_award ?? ""}
              onChange={(e) => setQ({ ...q, full_award: e.target.value as EosbQuery["full_award"] })}
              options={[{ value: "", label: t("eosb.art87.none") }, ...["marriage", "childbirth", "force_majeure"].map((k) => ({ value: k, label: t(`eosb.art87.${k}`) }))]}
            />
          )}
          {reason === "resignation" && (q.full_award === "marriage" || q.full_award === "childbirth") && (
            <TextField label={t("eosb.eventDate")} name="event_date" type="date" value={q.event_date ?? ""} onChange={(e) => setQ({ ...q, event_date: e.target.value || undefined })} />
          )}
          <TextField label={t("eosb.noticeUnserved")} name="notice_unserved_days" dir="ltr" inputMode="numeric" value={q.notice_unserved_days ? String(q.notice_unserved_days) : ""} onChange={(e) => setQ({ ...q, notice_unserved_days: Number(e.target.value) || 0 })} />
          <CheckField className="self-end pb-3" label={t("eosb.unfair")} checked={Boolean(q.unfair)} onChange={(e) => setQ({ ...q, unfair: e.target.checked })} />
        </div>
        {result.isError && <Alert>{errors.fields.detail ?? errors.general}</Alert>}
        {data && (
          <>
            <dl className="grid gap-x-6 gap-y-3 rounded-card bg-teal-soft px-4 py-3 text-sm text-teal-ink sm:grid-cols-4">
              <div>
                <dt>{t("eosb.service")}</dt>
                <dd className="num font-semibold">{t("eosb.serviceValue", { y: format.number(data.service.years), m: format.number(data.service.months), d: format.number(data.service.days) })}</dd>
                {data.service.excluded_days > 0 && <dd className="text-xs">{t("eosb.excluded", { n: format.number(data.service.excluded_days) })}</dd>}
              </div>
              <div>
                <dt>{t("eosb.wage")}</dt>
                <dd><Money amount={data.wage} fractionDigits={[2, 2]} className="font-semibold" /></dd>
              </div>
              <div>
                <dt>{t("eosb.fullAwardValue")}</dt>
                <dd><Money amount={data.full_award} fractionDigits={[2, 2]} className="font-semibold" /></dd>
              </div>
              <div>
                <dt>{t(`eosb.rules.${data.fraction_rule}`)}</dt>
                <dd><Money amount={data.award} fractionDigits={[2, 2]} className="text-lg font-bold" /></dd>
              </div>
              {data.compensation && (
                <div>
                  <dt>{t("eosb.compensation")}</dt>
                  <dd><Money amount={data.compensation} fractionDigits={[2, 2]} className="font-semibold" /></dd>
                </div>
              )}
              {Number(data.notice_pay) > 0 && (
                <div>
                  <dt>{t("eosb.noticePay")}</dt>
                  <dd><Money amount={data.notice_pay} fractionDigits={[2, 2]} className="font-semibold" /></dd>
                </div>
              )}
            </dl>
            <ol className="flex flex-col gap-1 text-sm">
              {data.steps.map((s, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-2 border-b border-line py-1">
                  <span>{t(`eosb.steps.${s.rule}`)}</span>
                  <span dir="ltr" className="num text-xs text-muted">{s.expr}</span>
                </li>
              ))}
            </ol>
            {data.notes.map((n) => (
              <Alert key={n} tone="info">{n}</Alert>
            ))}
            <p className="text-xs text-muted">{t("eosb.toConfirm")}</p>
          </>
        )}
      </div>
    </Card>
  );
}
