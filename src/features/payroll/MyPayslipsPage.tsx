import { useMutation, useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { useTranslation } from "react-i18next";

import { type Payslip, payslips } from "@/api/payroll";
import { useScopeKey } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { Money } from "@/design/Money";
import { openFile } from "@/features/employees/download";
import { Page } from "@/layout/Page";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

/** /payslips — "my payslips" (#66): the employee's published payslips, each opened as its PDF through a signed link. */
export default function MyPayslipsPage() {
  const { t } = useTranslation();
  const scope = useScopeKey();
  const list = useQuery({ queryKey: ["payslips", "mine", ...scope], queryFn: payslips.mine });
  return (
    <Page title={t("payslips.title")}>
      <PayslipList rows={list.data ?? []} loading={list.isPending} empty={t("payslips.noneMine")} />
    </Page>
  );
}

/** A list of payslips with their PDF (the employee's own, or an employee's in their file). */
export function PayslipList({ rows, loading, empty, title }: { rows: Payslip[]; loading: boolean; empty: string; title?: string }) {
  const { t } = useTranslation();
  const format = useFormat();
  const open = useMutation({ mutationFn: (id: number) => openFile(() => payslips.link(id)) });
  const columns: Column<Payslip>[] = [
    { id: "month", header: t("payslips.month"), cell: (p) => <span className="font-semibold">{format.date(`${p.month}-01`, "monthYear")}</span> },
    { id: "net", header: t("payroll.columns.net"), cell: (p) => <Money amount={p.net} currency={p.currency} fractionDigits={[2, 2]} className="font-bold" /> },
    { id: "published", header: t("payslips.published"), cell: (p) => <span className="num text-sm text-muted">{format.date(p.published_at)}</span> },
    {
      id: "pdf",
      header: <span className="sr-only">{t("common.actions")}</span>,
      cell: (p) => (
        <Button size="sm" variant="outline" icon={<FileText className="size-4" />} disabled={open.isPending} onClick={() => open.mutate(p.id)}>
          {t("payslips.open", { month: format.date(`${p.month}-01`, "monthYear") })}
        </Button>
      ),
    },
  ];
  return (
    <Card variant="solid" title={title ?? t("payslips.title")} subtitle={t("payslips.hint")}>
      {open.error && <Alert className="mb-3">{apiErrors(open.error, t("common.loadFailed")).general}</Alert>}
      <DataTable caption={title ?? t("payslips.title")} columns={columns} rows={rows} rowKey={(p) => String(p.id)} loading={loading} empty={empty} minWidth={560} />
    </Card>
  );
}
