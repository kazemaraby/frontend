import { useMutation } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { type PayrollBatch, type PayrollRun, runs } from "@/api/payroll";
import { useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { TextField } from "@/design/Field";
import { Money } from "@/design/Money";
import { Pill } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { toISODate } from "@/lib/format";
import { useFormat } from "@/lib/useFormat";

/** The run's batches (#97): split by branch, by bank or as one; each with its payment date, marked paid once the
 * money is out (an approved run only). The run is paid when every batch is. */
export function BatchesTab({ run, onChanged }: { run: PayrollRun; onChanged: () => Promise<unknown> }) {
  const { t } = useTranslation();
  const format = useFormat();
  const { can } = useSession();
  const manage = can("payroll.manage");
  const act = useMutation({ mutationFn: (fn: () => Promise<unknown>) => fn(), onSuccess: onChanged });
  const errors = apiErrors(act.error, t("common.saveFailed"));
  const anyPaid = run.batches.some((b) => b.paid_on);
  const columns: Column<PayrollBatch>[] = [
    { id: "name", header: t("batches.name"), cell: (b) => <span className="font-semibold">{b.name}</span> },
    { id: "headcount", header: t("batches.headcount"), cell: (b) => <span className="num">{format.number(b.headcount)}</span>, className: "w-28" },
    { id: "net", header: t("payroll.columns.net"), cell: (b) => <Money amount={b.net} className="font-bold" /> },
    {
      id: "date",
      header: t("batches.paymentDate"),
      cell: (b) =>
        manage && !b.paid_on ? (
          <TextField label={t("batches.paymentDateOf", { name: b.name })} className="[&_label]:sr-only" name={`date-${b.id}`} type="date" value={b.payment_date ?? ""} onChange={(e) => act.mutate(() => runs.saveBatch(run.id, b.id, { payment_date: e.target.value || null }))} />
        ) : (
          <span className="num">{b.payment_date ? format.date(b.payment_date) : "—"}</span>
        ),
    },
    {
      id: "paid",
      header: t("batches.paid"),
      cell: (b) =>
        b.paid_on ? (
          <Pill tone="green">{t("batches.paidOn", { date: format.date(b.paid_on) })}</Pill>
        ) : manage && run.stage === "locked" ? (
          <Button size="sm" icon={<CheckCircle2 className="size-4" />} disabled={act.isPending} onClick={() => act.mutate(() => runs.paid(run.id, b.id, b.payment_date ?? toISODate(new Date())))}>
            {t("batches.markPaid")}
          </Button>
        ) : (
          <Pill tone="amber">{t("batches.notPaid")}</Pill>
        ),
    },
  ];
  return (
    <Card
      title={t("batches.title")}
      subtitle={t("batches.hint")}
      action={
        manage &&
        run.stage !== "draft" &&
        !anyPaid && (
          <span className="flex flex-wrap gap-2">
            {(["branch", "bank", "single"] as const).map((by) => (
              <Button key={by} size="sm" variant="outline" disabled={act.isPending} onClick={() => act.mutate(() => runs.split(run.id, by))}>
                {t(`batches.by.${by}`)}
              </Button>
            ))}
          </span>
        )
      }
    >
      {run.stage !== "locked" && run.stage !== "paid" && <Alert tone="info" className="mb-3">{t("batches.beforeLock")}</Alert>}
      {(errors.general || errors.fields.detail) && <Alert className="mb-3">{errors.fields.detail ?? errors.general}</Alert>}
      <DataTable caption={t("batches.title")} columns={columns} rows={run.batches} rowKey={(b) => String(b.id)} empty={t("batches.none")} minWidth={760} />
    </Card>
  );
}
