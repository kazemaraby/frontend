import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Lock, LockOpen } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type AttendanceMonth, periods } from "@/api/attendance";
import { useScopeKey } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { Dialog } from "@/design/Dialog";
import { TextArea } from "@/design/Field";
import { Pill } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

/** Attendance months (Phase 3 task 15, decision 8 TO CONFIRM): payroll locks a month once it has ended (its days are
 * built a last time); a locked month refuses changes. Unlocking needs a reason; both are in the audit log. */
export function MonthsTab() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [action, setAction] = useState<{ kind: "lock" | "unlock"; month: AttendanceMonth } | null>(null);
  const list = useQuery({ queryKey: ["attendance-periods", year, ...scope], queryFn: () => periods.list(year) });
  const names = format.months();
  return (
    <Card
      variant="solid"
      title={t("months.title")}
      subtitle={t("months.hint")}
      action={
        <div className="flex items-center gap-1">
          <IconButton size="sm" variant="plain" label={t("months.previousYear")} icon={<ChevronRight className="rtl:rotate-0 ltr:rotate-180" />} onClick={() => setYear(year - 1)} />
          <span className="num min-w-14 text-center font-semibold">{year}</span>
          <IconButton size="sm" variant="plain" label={t("months.nextYear")} icon={<ChevronLeft className="rtl:rotate-0 ltr:rotate-180" />} onClick={() => setYear(year + 1)} />
        </div>
      }
    >
      <ul aria-label={t("months.title")} className="flex flex-col divide-y divide-line">
        {(list.data?.months ?? []).map((m) => {
          const name = names[Number(m.month.slice(5)) - 1];
          return (
            <li key={m.month} className="flex flex-wrap items-center gap-3 py-3">
              <span className="min-w-28 font-semibold text-ink">{name}</span>
              <Pill tone={m.status === "locked" ? "navy" : m.ended ? "amber" : "neutral"}>
                {m.status === "locked" ? t("months.locked") : m.ended ? t("months.openEnded") : t("months.running")}
              </Pill>
              {m.status === "locked" && m.locked_by && m.locked_at && (
                <span className="text-sm text-muted">{t("months.lockedBy", { name: format.pick(m.locked_by), ago: format.relative(m.locked_at) })}</span>
              )}
              {m.status === "open" && m.unlock_reason && m.unlocked_by && (
                <span className="text-sm text-muted">{t("months.unlockedBy", { name: format.pick(m.unlocked_by), reason: m.unlock_reason })}</span>
              )}
              {list.data?.can_lock && (
                <span className="ms-auto">
                  {m.status === "locked" ? (
                    <Button size="sm" variant="outline" icon={<LockOpen className="size-4" />} onClick={() => setAction({ kind: "unlock", month: m })}>
                      {t("months.unlock")}
                    </Button>
                  ) : (
                    m.ended && (
                      <Button size="sm" icon={<Lock className="size-4" />} onClick={() => setAction({ kind: "lock", month: m })}>
                        {t("months.lock")}
                      </Button>
                    )
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {action && <MonthDialog {...action} name={`${names[Number(action.month.month.slice(5)) - 1]} ${year}`} onClose={() => setAction(null)} />}
    </Card>
  );
}

function MonthDialog({ kind, month, name, onClose }: { kind: "lock" | "unlock"; month: AttendanceMonth; name: string; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<number | null>(null);
  const run = useMutation({
    mutationFn: () => (kind === "lock" ? periods.lock(month.month) : periods.unlock(month.month, reason)),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["attendance-periods"] });
      await queryClient.invalidateQueries({ queryKey: ["attendance-days"] });
      const left = (result as { pending?: number }).pending ?? 0; // locking says which requests still wait
      if (left) setPending(left);
      else onClose();
    },
  });
  const errors = apiErrors(run.error, t("common.saveFailed"));
  if (pending)
    return (
      <Dialog open onClose={onClose} title={t("months.lockedTitle", { name })} footer={<Button onClick={onClose}>{t("common.close")}</Button>}>
        <Alert tone="warning">{t("months.pendingLeft", { count: pending })}</Alert>
      </Dialog>
    );
  return (
    <Dialog
      open
      onClose={onClose}
      title={t(kind === "lock" ? "months.lockTitle" : "months.unlockTitle", { name })}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={run.isPending || (kind === "unlock" && !reason.trim())} onClick={() => run.mutate()}>
            {t(kind === "lock" ? "months.lock" : "months.unlock")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        <p>{t(kind === "lock" ? "months.lockExplain" : "months.unlockExplain")}</p>
        {kind === "unlock" && <TextArea label={t("months.reason")} name="reason" value={reason} onChange={(e) => setReason(e.target.value)} error={errors.fields.reason} required />}
        {(errors.general || errors.fields.month) && <Alert>{errors.fields.month ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
