import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileDown } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiError, type Decision, endpoints } from "@/api";
import { Button } from "@/design/Button";
import { Dialog } from "@/design/Dialog";
import { TextArea } from "@/design/Field";
import { Pill, StatusChip } from "@/design/Pill";
import { openFile } from "@/features/employees/download";
import { KIND_OF_TYPE, useComposer } from "@/features/selfservice/composer";
import { useFormat } from "@/lib/useFormat";

export function useInvalidateRequests() {
  const queryClient = useQueryClient();
  return () => Promise.all(["approvals", "requests", "notifications"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
}

export const errorText = (t: (k: string) => string, e: unknown) =>
  e instanceof ApiError && e.status === 409 ? t("approvals.conflict") : t("common.loadFailed");

/** Approve, return or reject one task (a reason is needed to return or reject). */
export function DecisionDialog({ taskId, title, decision, onClose, onDone }: { taskId: number; title: string; decision: Decision; onClose: () => void; onDone?: () => void }) {
  const { t } = useTranslation();
  const invalidate = useInvalidateRequests();
  const [comment, setComment] = useState("");
  const needsReason = decision !== "approve";
  const mutation = useMutation({
    mutationFn: () => endpoints.decide(taskId, decision, comment),
    onSuccess: async () => {
      await invalidate();
      onClose();
      onDone?.();
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={t(`approvals.decision.${decision}.title`)}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant={decision === "approve" ? "accent" : "primary"} disabled={mutation.isPending || (needsReason && !comment.trim())} onClick={() => mutation.mutate()}>
            {t(`approvals.decision.${decision}.confirm`)}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-muted">{title}</p>
      <TextArea label={needsReason ? t("approvals.reason") : t("approvals.commentOptional")} value={comment} onChange={(e) => setComment(e.target.value)} required={needsReason} autoFocus />
      {mutation.isError && (
        <p role="alert" className="mt-3 rounded-card bg-danger-soft px-4 py-3 text-sm text-danger">
          {errorText(t, mutation.error)}
        </p>
      )}
    </Dialog>
  );
}

/** One request: what is asked (the type's summary), where it waits and its timeline. The requester withdraws it or,
 * when it was returned, corrects it in its own form; an approver decides their task here. */
export function RequestDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const invalidate = useInvalidateRequests();
  const composer = useComposer();
  const [decision, setDecision] = useState<Decision | null>(null);
  const detail = useQuery({ queryKey: ["requests", "detail", id], queryFn: () => endpoints.request(id) });
  const cancel = useMutation({ mutationFn: () => endpoints.cancelRequest(id), onSuccess: invalidate });
  const r = detail.data;
  const kind = r ? KIND_OF_TYPE[r.request_type] : undefined;
  const canEdit = Boolean(r && r.status === "returned" && r.can_cancel && kind && composer.kinds.includes(kind));
  const title = r ? format.pick({ ar: r.title_ar, en: r.title_en }) : "";
  const footer = r && (canEdit || r.can_cancel || r.my_task) && (
    <>
      {r.my_task && (
        <>
          <Button variant="accent" onClick={() => setDecision("approve")}>
            {t("approvals.decision.approve.short")}
          </Button>
          <Button variant="outline" onClick={() => setDecision("return")}>
            {t("approvals.decision.return.short")}
          </Button>
          <Button variant="outline" onClick={() => setDecision("reject")}>
            {t("approvals.decision.reject.short")}
          </Button>
        </>
      )}
      {canEdit && (
        <Button
          variant="accent"
          onClick={() => {
            onClose();
            composer.open(kind!, r.object_id);
          }}
        >
          {t("approvals.editAndResubmit")}
        </Button>
      )}
      {r.can_cancel && (
        <Button variant="outline" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
          {t("approvals.cancelRequest")}
        </Button>
      )}
    </>
  );
  const returned = r?.status === "returned" ? [...r.events].reverse().find((e) => e.action === "returned") : undefined;
  return (
    <>
      <Dialog open size="lg" onClose={onClose} title={r ? title : t("common.loading")} footer={footer || undefined}>
        {detail.isPending || !r ? (
          <p className="text-muted">{t("common.loading")}</p>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="teal">{format.pick(r.type_name)}</Pill>
              <StatusChip status={r.status} label={t(`requestStatus.${r.status}`)} />
              {r.current_step && <span className="text-sm text-muted">{t("approvals.waitingAt", { step: format.pick(r.current_step) })}</span>}
            </div>
            {returned && (
              <p role="status" className="rounded-card bg-amber-100 px-4 py-3 text-sm text-amber-800">
                {t("approvals.returnedBecause", { name: returned.actor ? format.pick({ ar: returned.actor.name_ar, en: returned.actor.name_en }) : "" })}{" "}
                <span className="font-semibold">{returned.comment}</span>
              </p>
            )}
            <dl className="grid gap-3 sm:grid-cols-[10rem_1fr]">
              <dt className="text-sm text-muted">{t("approvals.requester")}</dt>
              <dd>{format.pick({ ar: r.requester.name_ar, en: r.requester.name_en })}</dd>
              {r.summary.map((row) => (
                <div key={row.label.en} className="contents">
                  <dt className="text-sm text-muted">{format.pick(row.label)}</dt>
                  <dd className="whitespace-pre-line">{row.value || "—"}</dd>
                </div>
              ))}
              {r.has_attachment && (
                <div className="contents">
                  <dt className="text-sm text-muted">{t("approvals.attachment")}</dt>
                  <dd>
                    <Button size="sm" variant="outline" icon={<FileDown className="size-4" />} onClick={() => void openFile(() => endpoints.requestAttachment(r.id))}>
                      {t("approvals.openAttachment")}
                    </Button>
                  </dd>
                </div>
              )}
            </dl>
            <section aria-label={t("approvals.timeline")}>
              <h3 className="mb-3 font-semibold">{t("approvals.timeline")}</h3>
              <ol className="flex flex-col gap-3 border-s-2 border-line ps-4">
                {r.events.map((e, i) => (
                  <li key={i} className="relative">
                    <span aria-hidden="true" className="absolute -start-[1.4rem] top-1.5 size-2.5 rounded-full bg-teal-dark" />
                    <p className="text-sm">
                      <span className="font-semibold">{t(`approvals.events.${e.action}`)}</span>
                      {e.actor && <> · {format.pick({ ar: e.actor.name_ar, en: e.actor.name_en })}</>}
                    </p>
                    {e.comment && e.comment !== "no approver" && <p className="mt-0.5 text-sm text-muted">{e.comment}</p>}
                    <p className="num text-xs text-subtle">
                      {format.date(e.created_at.slice(0, 10), "dayMonthYear")} · {format.relative(e.created_at)}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
            {cancel.isError && (
              <p role="alert" className="rounded-card bg-danger-soft px-4 py-3 text-sm text-danger">
                {errorText(t, cancel.error)}
              </p>
            )}
          </div>
        )}
      </Dialog>
      {decision && r?.my_task && <DecisionDialog taskId={r.my_task} title={title} decision={decision} onClose={() => setDecision(null)} onDone={onClose} />}
    </>
  );
}
