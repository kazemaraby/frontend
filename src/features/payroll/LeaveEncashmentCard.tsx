import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { Employee } from "@/api";
import { encashment } from "@/api/payroll";
import { Alert } from "@/design/Alert";
import { Card } from "@/design/Card";
import { TextField } from "@/design/Field";
import { Money } from "@/design/Money";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

/** The leave balance paid at exit (Phase 4 task 18, Art. 111) in the employee's salary tab: each paid, accruing leave
 * type's balance on the last working day (the planned one by default) at the last daily wage. During the employment
 * leave isn't paid instead of taken (Art. 109): this is what the final settlement will pay. */
export function LeaveEncashmentCard({ employee }: { employee: Employee }) {
  const { t } = useTranslation();
  const format = useFormat();
  const [lastDay, setLastDay] = useState<string | undefined>();
  const result = useQuery({ queryKey: ["leave-encashment", employee.id, lastDay], queryFn: () => encashment.of(employee.id, lastDay), placeholderData: (previous) => previous });
  const data = result.data;
  const errors = apiErrors(result.error, t("common.loadFailed"));
  return (
    <Card variant="solid" title={t("encashment.title")} subtitle={t("encashment.hint")}>
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label={t("eosb.lastDay")} name="encashment_last_day" type="date" value={lastDay ?? data?.last_day ?? ""} onChange={(e) => setLastDay(e.target.value || undefined)} error={errors.fields.last_day} />
        </div>
        {result.isError && !errors.fields.last_day && <Alert>{errors.general}</Alert>}
        {data && (
          <>
            {data.lines.length === 0 ? (
              <p className="text-sm text-muted">{t("encashment.none")}</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {data.lines.map((line) => (
                  <li key={line.leave_type} className="flex flex-wrap justify-between gap-2 border-b border-line py-1">
                    <span>
                      {format.name(line)} · <span className="num">{t("encashment.days", { n: format.number(Number(line.days), [0, 2]) })}</span>
                    </span>
                    <span dir="ltr" className="num text-xs text-muted">{line.expr}</span>
                  </li>
                ))}
              </ul>
            )}
            <div role="status" className="flex flex-wrap justify-between gap-2 rounded-card bg-teal-soft px-4 py-3 text-sm text-teal-ink">
              <span>
                {t("encashment.dailyWage")} <Money amount={data.daily_wage} fractionDigits={[2, 2]} />
              </span>
              <span>
                {t("encashment.total")} <Money amount={data.amount} fractionDigits={[2, 2]} className="text-lg font-bold" />
              </span>
            </div>
            {data.notes.map((n) => (
              <Alert key={n} tone="info">{n}</Alert>
            ))}
          </>
        )}
      </div>
    </Card>
  );
}
