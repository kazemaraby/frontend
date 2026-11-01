import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type PayCalculation, penalties, type Proposal } from "@/api/payroll";
import { useScopeKey } from "@/auth/session";
import { Button } from "@/design/Button";
import { Alert } from "@/design/Alert";
import { Card } from "@/design/Card";
import { Money } from "@/design/Money";
import { Pill } from "@/design/Pill";
import { FileActionDialog } from "@/features/employees/profile/DisciplineTab";
import { useFormat } from "@/lib/useFormat";

import { usePenaltyText } from "./PenaltiesTab";

const KIND_TONES = { earning: "green", deduction: "salmon", employer_cost: "navy" } as const;

/** The payroll engine's month for one employee (Phase 4 task 4): the days paid, each prorated line with the
 * arithmetic behind it, leave paid below full pay and leave pay in advance (task 5), and the totals. Attendance, GOSI
 * and the rest join as their tasks are built. */
export function PayCalculationCard({ calc, employeeId, canFile = false }: { calc: PayCalculation; employeeId: number; canFile?: boolean }) {
  const scope = useScopeKey();
  const table = useQuery({ queryKey: ["attendance-penalties", ...scope], queryFn: penalties.table, enabled: canFile });
  const [filing, setFiling] = useState<Proposal | null>(null);
  const { t } = useTranslation();
  const format = useFormat();
  const money = (amount: string) => <Money amount={amount} currency={calc.currency} fractionDigits={[2, 2]} />;
  const penalty = usePenaltyText();
  return (
    <Card variant="solid" title={t("payCalc.title")} subtitle={t("payCalc.hint")}>
      <dl className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-card bg-neutral-soft px-4 py-3">
          <dt className="text-sm text-muted">{t("payCalc.paidDays")}</dt>
          <dd className="num text-lg font-semibold">{t("payCalc.daysOf", { days: format.number(calc.paid_days), calendar: format.number(calc.calendar_days), month: format.number(calc.month_days) })}</dd>
        </div>
        <div className="rounded-card bg-neutral-soft px-4 py-3">
          <dt className="text-sm text-muted">{t("payCalc.period")}</dt>
          <dd className="num text-lg font-semibold">{calc.period.start && calc.period.end ? format.dateRange(calc.period.start, calc.period.end) : "—"}</dd>
        </div>
        <div className="rounded-card bg-neutral-soft px-4 py-3">
          <dt className="text-sm text-muted">{t("payCalc.dailyWage")}</dt>
          <dd className="text-lg font-semibold">{money(calc.daily_wage)}</dd>
        </div>
        <div className="rounded-card bg-neutral-soft px-4 py-3">
          <dt className="text-sm text-muted">{t("payCalc.hourlyWage")}</dt>
          <dd className="text-lg font-semibold">{calc.hourly_wage ? money(calc.hourly_wage) : "—"}</dd>
        </div>
        {calc.gosi_wage && (
          <div className="rounded-card bg-neutral-soft px-4 py-3">
            <dt className="text-sm text-muted">{t("payCalc.gosiWage")}</dt>
            <dd className="text-lg font-semibold">{money(calc.gosi_wage)}</dd>
          </div>
        )}
      </dl>
      {calc.unpaid.map((u) => (
        <Alert key={u.start} tone="info" className="mb-2">
          {t(`payCalc.unpaid.${u.reason}`, { range: format.dateRange(u.start, u.end) })}
        </Alert>
      ))}
      {calc.notes.map((n) => (
        <Alert key={n} tone="warning" className="mb-2">
          {n}
        </Alert>
      ))}
      <table className="w-full text-sm">
        <caption className="sr-only">{t("payCalc.title")}</caption>
        <thead className="text-muted">
          <tr>
            <th scope="col" className="py-1 text-start font-medium">{t("components.name")}</th>
            <th scope="col" className="py-1 text-start font-medium">{t("payCalc.how")}</th>
            <th scope="col" className="py-1 text-end font-medium">{t("employeePay.amount")}</th>
          </tr>
        </thead>
        <tbody>
          {calc.lines.map((ln) => (
            <tr key={ln.code} className="border-t border-line align-top">
              <td className="py-2">
                <span className="flex items-center gap-2">
                  <Pill tone={KIND_TONES[ln.kind]}>{t(`components.kinds.${ln.kind}`)}</Pill>
                  <span>{format.name(ln)}</span>
                </span>
              </td>
              <td className="py-2 text-muted">
                <ul className="flex flex-col gap-0.5">
                  {ln.steps.map((s, i) => (
                    <li key={i}>
                      {s.rule === "gosi" ? t(`gosi.branches.${String(s.values.branch)}`) : t(`payCalc.rules.${s.rule}`)}
                      {s.rule.startsWith("advance") && Boolean(s.values.month) && <span className="num ms-1">({String(s.values.month)})</span>}
                      {s.rule !== "full" && s.rule !== "not_prorated" && (
                        <span dir="ltr" className="num ms-2 text-xs">
                          {s.expr}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </td>
              <td className="py-2 text-end">{money(ln.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="font-semibold">
          <tr className="border-t-2 border-line-strong">
            <td className="py-2" colSpan={2}>{t("payCalc.gross")}</td>
            <td className="py-2 text-end">{money(calc.gross)}</td>
          </tr>
          <tr>
            <td className="py-1" colSpan={2}>{t("payCalc.deductions")}</td>
            <td className="py-1 text-end">{money(calc.deductions)}</td>
          </tr>
          <tr>
            <td className="py-1" colSpan={2}>{t("payCalc.net")}</td>
            <td className="py-1 text-end">{money(calc.net)}</td>
          </tr>
        </tfoot>
      </table>
      {calc.proposals.length > 0 && (
        <section aria-labelledby="pay-proposals" className="mt-6">
          <h3 id="pay-proposals" className="font-semibold text-ink">
            {t("payCalc.proposalsTitle")}
          </h3>
          <p className="mb-2 text-sm text-muted">{t("payCalc.proposalsHint")}</p>
          <ul className="flex flex-col gap-2">
            {calc.proposals.map((p) => (
              <li key={`${p.date}-${p.kind}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card border border-line px-4 py-2 text-sm">
                <span className="num font-medium">{format.date(p.date)}</span>
                <span>{t(`payCalc.proposalKinds.${p.kind}`, { count: p.value, value: format.number(p.value) })}</span>
                <span className="text-muted">{t("payCalc.occurrence", { n: format.number(p.occurrence), row: format.number(p.rule) })}</span>
                <Pill tone="amber">{penalty(p.penalty)}</Pill>
                {p.amount !== null && Number(p.amount) > 0 && <span className="ms-auto">{money(p.amount)}</span>}
                {canFile && table.data && (
                  <Button size="sm" variant="outline" onClick={() => setFiling(p)}>
                    {t("discipline.fileThis")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {calc.carried.length > 0 && (
        <section aria-labelledby="pay-carried" className="mt-6">
          <h3 id="pay-carried" className="font-semibold text-ink">
            {t("payCalc.carriedTitle")}
          </h3>
          <p className="mb-2 text-sm text-muted">{t("payCalc.carriedHint", { wage: format.number(calc.wage_due ?? "0", [2, 2]) })}</p>
          <ul className="flex flex-col gap-2">
            {calc.carried.map((c, i) => (
              <li key={i} className="flex flex-wrap items-center gap-3 rounded-card border border-line px-4 py-2 text-sm">
                <span className="font-medium">{c.code === "NET" ? t("payCalc.negativeNet") : format.name(calc.lines.find((ln) => ln.code === c.code) ?? { name_ar: c.code, name_en: c.code })}</span>
                <span className="text-muted">{t(`payCalc.reasons.${c.reason}`)}</span>
                <span className="ms-auto">{money(c.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {filing && (
        <FileActionDialog
          employee={{ id: employeeId }}
          prefill={{ attendanceRule: table.data?.rows.find((r) => r.number === filing.rule)?.id, occurredOn: filing.date }}
          onClose={() => setFiling(null)}
        />
      )}
    </Card>
  );
}
