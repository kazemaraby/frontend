import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Hourglass } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { type Employee, holds } from "@/api";
import { hr, type PendingApproval } from "@/api/hr";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { Pill } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

type Row = { key: string; title: string; approval: Omit<PendingApproval, "status"> & { status: string }; resend?: () => Promise<unknown> };

/** HR changes of this employee waiting for approval (status, promotion / transfer / salary, probation), with where
 * each one waits or why it came back. Shown to those who can see them; the request opens in /approvals. */
export function PendingApprovals({ employee }: { employee: Employee }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: ["employee", employee.id, "status"], queryFn: () => hr.status(employee.id) });
  const actions = useQuery({ queryKey: ["employee", employee.id, "actions"], queryFn: () => hr.actions(employee.id) });
  const contracts = useQuery({ queryKey: ["employee", employee.id, "contracts"], queryFn: () => hr.contracts(employee.id) });
  const resend = useMutation({
    mutationFn: (row: Row) => row.resend!(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employee", employee.id] }),
  });

  const rows: Row[] = [];
  const waiting = status.data?.pending_request;
  if (waiting) {
    rows.push({ key: "status", title: t("pendingApprovals.status", { to: t(`status.${waiting.to}`) }), approval: waiting });
  }
  for (const action of actions.data ?? []) {
    if (action.status !== "pending" || !action.approval) continue;
    rows.push({
      key: `action-${action.id}`,
      title: t(`employee.actions.types.${action.action_type}`),
      approval: action.approval,
      resend: holds(employee, "employees.manage_lifecycle") ? () => hr.submitAction(action.id) : undefined,
    });
  }
  for (const contract of contracts.data ?? []) {
    if (contract.probation_request) {
      rows.push({
        key: `probation-${contract.id}`,
        title: t(`contracts.decisions.${contract.probation_request.decision}`),
        approval: contract.probation_request,
      });
    }
  }
  if (!rows.length) return null;

  return (
    <Card variant="solid" title={t("pendingApprovals.title")} subtitle={t("pendingApprovals.hint")} aria-label={t("pendingApprovals.title")}>
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-wrap items-center gap-3 rounded-tile border border-line px-4 py-3">
            <Hourglass aria-hidden="true" className="size-4 text-amber-700" />
            <span className="font-medium">{row.title}</span>
            {row.approval.status === "returned" ? (
              <Pill tone="salmon">{t("requestStatus.returned")}</Pill>
            ) : (
              <Pill tone="amber">
                {row.approval.step ? t("approvals.waitingAt", { step: format.pick(row.approval.step) }) : t("requestStatus.pending")}
              </Pill>
            )}
            {row.approval.comment && <span className="text-sm text-muted">“{row.approval.comment}”</span>}
            <span className="ms-auto flex gap-2">
              {row.approval.status === "returned" && row.resend && (
                <Button size="sm" variant="outline" disabled={resend.isPending} onClick={() => resend.mutate(row)}>
                  {t("pendingApprovals.sendAgain")}
                </Button>
              )}
              {row.approval.id && (
                <Link to={`/approvals?tab=mine&request=${row.approval.id}`} className="inline-flex h-9 items-center rounded-full px-3 text-sm font-medium text-teal-dark hover:underline">
                  {t("pendingApprovals.open")}
                </Link>
              )}
            </span>
          </li>
        ))}
      </ul>
      {resend.isError && <Alert className="mt-3">{apiErrors(resend.error, t("common.saveFailed")).general ?? t("common.saveFailed")}</Alert>}
    </Card>
  );
}
