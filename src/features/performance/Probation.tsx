import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type ProbationEvaluation, type ProbationForm, probationApi, type ProbationRecommendation, type ProbationState } from "@/api/performance";
import { useScopeKey } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { DateInput } from "@/design/DateInput";
import { Dialog } from "@/design/Dialog";
import { FormSelect, TextArea } from "@/design/Field";
import { Pill, type PillTone } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

const STATE_TONES: Record<ProbationState, PillTone> = { open: "amber", sent: "sky", returned: "salmon", decided: "green" };
const RECOMMENDATIONS: Exclude<ProbationRecommendation, "">[] = ["confirm", "extend", "end"];

/** Probation evaluations (#124): those the user reviews (and HR's), opened before probation ends; the manager's
 * recommendation goes for approval as the probation decision. */
export function ProbationCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const list = useQuery({ queryKey: ["probation-evaluations", ...scope], queryFn: () => probationApi.list() });
  const [open, setOpen] = useState<ProbationEvaluation | null>(null);
  const columns: Column<ProbationEvaluation>[] = [
    { id: "name", header: t("performance.probation.employee"), cell: (e) => <span className="flex flex-col"><span className="font-semibold text-ink">{format.name(e.employee)}</span><span className="text-sm text-muted">{e.employee.department ? format.name(e.employee.department) : ""}</span></span> },
    { id: "start", header: t("performance.probation.started"), cell: (e) => <span className="num text-sm">{format.date(e.contract.start_date)}</span> },
    { id: "end", header: t("performance.probation.ends"), cell: (e) => <span className="num text-sm font-semibold">{format.date(e.probation_end)}</span> },
    { id: "recommendation", header: t("performance.probation.recommendation"), cell: (e) => (e.recommendation ? t(`performance.probation.recommendations.${e.recommendation}`) : "—") },
    { id: "state", header: t("performance.probation.state"), cell: (e) => <Pill tone={STATE_TONES[e.state]}>{t(`performance.probation.states.${e.state}`)}</Pill> },
    { id: "open", header: t("performance.probation.evaluation"), cell: (e) => <Button size="sm" variant={e.can_edit ? "accent" : "outline"} onClick={() => setOpen(e)}>{e.can_edit ? t("performance.probation.evaluate") : t("common.view")}</Button> },
  ];
  return (
    <Card title={t("performance.probation.title")} subtitle={t("performance.probation.subtitle")}>
      <DataTable caption={t("performance.probation.title")} columns={columns} rows={list.data?.results ?? []} rowKey={(e) => String(e.id)} loading={list.isPending} empty={t("performance.probation.empty")} />
      {open && <EvaluationDialog evaluation={open} onClose={() => setOpen(null)} />}
    </Card>
  );
}

function EvaluationDialog({ evaluation, onClose }: { evaluation: ProbationEvaluation; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const [v, setV] = useState<ProbationForm>({ ratings: evaluation.ratings, strengths: evaluation.strengths, improvements: evaluation.improvements, recommendation: evaluation.recommendation, new_end_date: evaluation.new_end_date, notes: evaluation.notes });
  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: ["probation-evaluations"] });
  };
  const save = useMutation({ mutationFn: () => probationApi.save(evaluation.id, v), onSuccess: done });
  const submit = useMutation({
    mutationFn: async () => {
      await probationApi.save(evaluation.id, v);
      return probationApi.submit(evaluation.id);
    },
    onSuccess: async () => {
      await done();
      onClose();
    },
  });
  const error = submit.error ?? save.error;
  const errors = apiErrors(error, t("common.saveFailed"));
  const editable = evaluation.can_edit;
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={`${t("performance.probation.evaluation")} · ${format.name(evaluation.employee)}`}
      footer={
        editable && (
          <>
            <Button variant="outline" disabled={save.isPending} onClick={() => save.mutate()}>
              {t("common.save")}
            </Button>
            <Button variant="accent" disabled={submit.isPending || !v.recommendation} onClick={() => submit.mutate()}>
              {t("performance.probation.send")}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <p className="num text-sm text-muted">{t("performance.probation.period", { start: format.date(evaluation.contract.start_date), end: format.date(evaluation.probation_end), days: evaluation.contract.probation_days })}</p>
        {evaluation.state === "returned" && <Alert tone="warning">{t("performance.probation.returnedHint")}</Alert>}
        {evaluation.criteria.length > 0 && (
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-1 text-sm font-medium text-ink">{t("performance.probation.ratings")}</legend>
            {evaluation.criteria.map((c) => (
              <FormSelect key={c.id} label={`${format.name(c)} (${format.number(c.weight)}%)`} name={`rating_${c.id}`} placeholder={t("common.choose")} disabled={!editable} value={v.ratings[c.id] ? String(v.ratings[c.id]) : ""} onChange={(e) => setV({ ...v, ratings: { ...v.ratings, [c.id]: Number(e.target.value) } })} options={Array.from({ length: evaluation.top }, (_, n) => ({ value: String(n + 1), label: format.number(n + 1) }))} />
            ))}
          </fieldset>
        )}
        {evaluation.score && <p className="text-sm">{t("performance.probation.score", { score: format.number(evaluation.score, [0, 2]) })}</p>}
        <TextArea label={t("performance.probation.strengths")} name="strengths" rows={2} disabled={!editable} value={v.strengths} onChange={(e) => setV({ ...v, strengths: e.target.value })} />
        <TextArea label={t("performance.probation.improvements")} name="improvements" rows={2} disabled={!editable} value={v.improvements} onChange={(e) => setV({ ...v, improvements: e.target.value })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormSelect label={t("performance.probation.recommendation")} name="recommendation" placeholder={t("common.choose")} disabled={!editable} value={v.recommendation} onChange={(e) => setV({ ...v, recommendation: e.target.value as ProbationRecommendation })} options={RECOMMENDATIONS.map((r) => ({ value: r, label: t(`performance.probation.recommendations.${r}`) }))} error={errors.fields.recommendation} />
          {v.recommendation === "extend" && <DateInput label={t("performance.probation.newEnd")} name="new_end_date" value={v.new_end_date} onChange={(d) => setV({ ...v, new_end_date: d })} error={errors.fields.new_end_date} />}
        </div>
        {v.recommendation === "end" && <Alert tone="warning">{t("performance.probation.endHint")}</Alert>}
        <TextArea label={t("performance.probation.notes")} name="notes" rows={2} disabled={!editable} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
        {editable && <p className="text-sm text-muted">{t("performance.probation.sendHint")}</p>}
        {(errors.fields.detail || errors.fields.ratings || errors.fields.review_date || errors.general) && <Alert>{errors.fields.detail ?? errors.fields.ratings ?? errors.fields.review_date ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
