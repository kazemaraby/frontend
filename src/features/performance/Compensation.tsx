import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type CompensationReview, compensationApi, performance, type Proposal, type RaiseMatrix, type ReviewStatus, type ReviewTotals, THIRDS } from "@/api/performance";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { DateInput } from "@/design/DateInput";
import { Dialog } from "@/design/Dialog";
import { FormSelect, SearchInput, TextField } from "@/design/Field";
import { Money } from "@/design/Money";
import { Pill, type PillTone } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

const STATUS_TONES: Record<ReviewStatus, PillTone> = { draft: "amber", pending: "sky", returned: "orange", approved: "green", rejected: "salmon", cancelled: "neutral" };

/** Merit raises and bonuses (#126): HR sets a cycle's review (performance.manage_compensation); a manager adjusts the
 * team's proposals within its share (performance.propose_compensation). Amounts only with salary access. */
export function CompensationCard() {
  const { can } = useSession();
  return can("performance.manage_compensation") ? <HrReview /> : <TeamProposals />;
}

function HrReview() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const cycles = useQuery({ queryKey: ["appraisal-cycles", ...scope], queryFn: performance.cycles.list });
  const choices = (cycles.data?.results ?? []).filter((c) => c.kind !== "probation" && c.status !== "draft");
  const [chosen, setChosen] = useState<number | null>(null);
  const cycle = choices.find((c) => c.id === chosen) ?? choices[0] ?? null;
  const reviews = useQuery({ queryKey: ["compensation-reviews", cycle?.id, ...scope], queryFn: () => compensationApi.reviews(cycle!.id), enabled: !!cycle });
  const review = reviews.data?.results.find((r) => r.status !== "rejected" && r.status !== "cancelled") ?? null;
  if (!cycles.isPending && !cycle)
    return (
      <Card>
        <p className="text-muted">{t("performance.compensation.noCycle")}</p>
      </Card>
    );
  return (
    <div className="flex flex-col gap-4">
      {choices.length > 1 && <FormSelect label={t("performance.goals.cycle")} name="compensation_cycle" className="w-64" value={cycle ? String(cycle.id) : ""} onChange={(e) => setChosen(Number(e.target.value))} options={choices.map((c) => ({ value: String(c.id), label: format.name(c) }))} />}
      {cycle && !reviews.isPending && (review ? <ReviewCard key={review.id} review={review} /> : <NewReview cycle={cycle.id} />)}
      {review?.generated_at && <ProposalsCard review={review.id} editable={review.info.editable} />}
    </div>
  );
}

function firstOfNextMonth() {
  const d = new Date();
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
}

function NewReview({ cycle }: { cycle: number }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const start = firstOfNextMonth();
  const [v, setV] = useState({ effective_date: start, bonus_month: start.slice(0, 7), raise_budget: "", bonus_budget: "" });
  const save = useMutation({
    mutationFn: () => compensationApi.save({ cycle, ...v, bonus_month: `${v.bonus_month}-01` }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["compensation-reviews"] }),
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Card title={t("performance.compensation.title")} subtitle={t("performance.compensation.newHint")}>
      <div className="flex flex-col gap-4">
        <Dates v={v} onChange={setV} errors={errors.fields} />
        {(errors.fields.cycle || errors.fields.detail || errors.general) && <Alert>{errors.fields.cycle ?? errors.fields.detail ?? errors.general}</Alert>}
        <Button variant="accent" className="self-start" disabled={save.isPending || !v.effective_date || !v.bonus_month || !v.raise_budget || !v.bonus_budget} onClick={() => save.mutate()}>
          {t("performance.compensation.create")}
        </Button>
      </div>
    </Card>
  );
}

type DatesValue = { effective_date: string; bonus_month: string; raise_budget: string; bonus_budget: string };

function Dates({ v, onChange, errors, disabled }: { v: DatesValue; onChange: (v: DatesValue) => void; errors: Record<string, string | undefined>; disabled?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <DateInput label={t("performance.compensation.effective")} name="effective_date" value={v.effective_date || null} onChange={(d) => onChange({ ...v, effective_date: d ?? "" })} error={errors.effective_date} disabled={disabled} />
      <TextField label={t("performance.compensation.bonusMonth")} name="bonus_month" type="month" value={v.bonus_month} onChange={(e) => onChange({ ...v, bonus_month: e.target.value })} error={errors.bonus_month} disabled={disabled} />
      <TextField label={t("performance.compensation.raiseBudget")} hint={t("performance.compensation.raiseBudgetHint")} name="raise_budget" inputMode="decimal" dir="ltr" value={v.raise_budget} onChange={(e) => onChange({ ...v, raise_budget: e.target.value })} error={errors.raise_budget} disabled={disabled} />
      <TextField label={t("performance.compensation.bonusBudget")} hint={t("performance.compensation.bonusBudgetHint")} name="bonus_budget" inputMode="decimal" dir="ltr" value={v.bonus_budget} onChange={(e) => onChange({ ...v, bonus_budget: e.target.value })} error={errors.bonus_budget} disabled={disabled} />
    </div>
  );
}

function ReviewCard({ review }: { review: CompensationReview }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const editable = review.info.editable;
  const [v, setV] = useState<DatesValue>({ effective_date: review.effective_date, bonus_month: review.bonus_month.slice(0, 7), raise_budget: review.raise_budget, bonus_budget: review.bonus_budget });
  const [raiseMatrix, setRaiseMatrix] = useState<RaiseMatrix>(review.raise_matrix);
  const [bonusMatrix, setBonusMatrix] = useState<Record<string, string>>(review.bonus_matrix);
  const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: ["compensation-reviews"] }), queryClient.invalidateQueries({ queryKey: ["compensation-proposals"] })]);
  const save = useMutation({ mutationFn: () => compensationApi.save({ id: review.id, ...v, bonus_month: `${v.bonus_month}-01`, raise_matrix: raiseMatrix, bonus_matrix: bonusMatrix }), onSuccess: refresh });
  const generate = useMutation({ mutationFn: () => compensationApi.generate(review.id), onSuccess: refresh });
  const submit = useMutation({ mutationFn: () => compensationApi.submit(review.id), onSuccess: refresh });
  const errors = apiErrors(save.error ?? generate.error ?? submit.error, t("common.saveFailed"));
  const detail = errors.fields.detail ?? errors.fields.raise_matrix ?? errors.fields.bonus_matrix ?? errors.general;
  return (
    <Card title={t("performance.compensation.reviewOf", { cycle: format.name(review.info.cycle) })} action={<Pill tone={STATUS_TONES[review.status]}>{t(`performance.compensation.statuses.${review.status}`)}</Pill>}>
      <div className="flex flex-col gap-5">
        <Dates v={v} onChange={setV} errors={errors.fields} disabled={!editable} />
        <section aria-label={t("performance.compensation.matrix")} className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <caption className="mb-2 text-start font-semibold text-ink">{t("performance.compensation.matrix")}</caption>
            <thead>
              <tr className="text-muted">
                <th className="p-2 text-start font-medium">{t("performance.compensation.rating")}</th>
                {THIRDS.map((third) => <th key={third} className="p-2 text-start font-medium">{t(`performance.compensation.raiseIn.${third}`)}</th>)}
                <th className="p-2 text-start font-medium">{t("performance.compensation.bonusPct")}</th>
              </tr>
            </thead>
            <tbody>
              {review.info.levels.map((level) => (
                <tr key={level.value} className="border-t border-line">
                  <th scope="row" className="p-2 text-start font-medium">
                    <span className="num">{level.value}</span> · {format.name(level)}
                  </th>
                  {THIRDS.map((third) => (
                    <td key={third} className="p-2">
                      <PctInput label={t("performance.compensation.cellLabel", { level: level.value, third: t(`performance.compensation.raiseIn.${third}`) })} name={`raise_${level.value}_${third}`} value={raiseMatrix[level.value]?.[third] ?? ""} disabled={!editable} onChange={(value) => setRaiseMatrix({ ...raiseMatrix, [level.value]: { ...raiseMatrix[level.value], [third]: value } })} />
                    </td>
                  ))}
                  <td className="p-2">
                    <PctInput label={t("performance.compensation.bonusLabel", { level: level.value })} name={`bonus_${level.value}`} value={bonusMatrix[level.value] ?? ""} disabled={!editable} onChange={(value) => setBonusMatrix({ ...bonusMatrix, [level.value]: value })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-sm text-muted">{t("performance.compensation.matrixHint")}</p>
        </section>
        <Totals totals={review.info.totals} />
        {detail && <Alert>{detail}</Alert>}
        {review.applied_at && <Alert tone="info">{t("performance.compensation.applied")}</Alert>}
        {editable && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={save.isPending} onClick={() => save.mutate()}>{t("common.save")}</Button>
            <Button variant="outline" disabled={generate.isPending} onClick={() => generate.mutate()}>{review.generated_at ? t("performance.compensation.regenerate") : t("performance.compensation.generate")}</Button>
            {review.generated_at && <Button variant="accent" disabled={submit.isPending} onClick={() => submit.mutate()}>{t("performance.compensation.submit")}</Button>}
          </div>
        )}
        {editable && !review.generated_at && <p className="text-sm text-muted">{t("performance.compensation.generateHint")}</p>}
      </div>
    </Card>
  );
}

function PctInput({ label, name, value, onChange, disabled }: { label: string; name: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <span className="flex items-center gap-1">
      <input aria-label={label} name={name} inputMode="decimal" dir="ltr" disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} className="num h-9 w-20 rounded-xl border border-line bg-surface px-2 text-ink disabled:opacity-60" />
      <span className="text-muted">%</span>
    </span>
  );
}

function Bar({ label, used, total, budget }: { label: string; used: number | null; total?: string; budget?: string }) {
  const { t } = useTranslation();
  const format = useFormat();
  const percent = used === null ? 0 : Math.min(100, used);
  const over = used !== null && used > 100;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-ink">{label}</span>
        <span className={over ? "font-semibold text-danger" : "text-muted"}>
          {total !== undefined && budget !== undefined ? (
            <>
              <Money amount={total} /> / <Money amount={budget} />
            </>
          ) : used !== null ? (
            t("performance.compensation.used", { percent: format.number(used, [0, 1]) })
          ) : (
            "—"
          )}
        </span>
      </div>
      <span className="h-2 overflow-hidden rounded-full bg-neutral-soft" role="progressbar" aria-label={label} aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
        <span className={over ? "block h-full rounded-full bg-danger" : "block h-full rounded-full bg-teal-dark"} style={{ inlineSize: `${percent}%` }} />
      </span>
    </div>
  );
}

const share = (total?: string, budget?: string) => (total === undefined || budget === undefined ? null : Number(budget) > 0 ? (Number(total) * 100) / Number(budget) : Number(total) > 0 ? 101 : 0);

function Totals({ totals }: { totals: ReviewTotals }) {
  const { t } = useTranslation();
  if (totals.raise_total === undefined) return <p className="text-sm text-muted">{t("performance.compensation.count", { count: Number(totals.count) })}</p>;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Bar label={t("performance.compensation.raises", { count: Number(totals.count) })} used={share(totals.raise_total, totals.raise_budget)} total={totals.raise_total} budget={totals.raise_budget} />
      <Bar label={t("performance.compensation.bonuses")} used={share(totals.bonus_total, totals.bonus_budget)} total={totals.bonus_total} budget={totals.bonus_budget} />
    </div>
  );
}

function ProposalsCard({ review, editable, title }: { review: number; editable: boolean; title?: string }) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const list = useQuery({ queryKey: ["compensation-proposals", review, ...scope], queryFn: () => compensationApi.proposals({ review }) });
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Proposal | null>(null);
  const rows = (list.data ?? []).filter((p) => !query || `${p.employee.name_ar} ${p.employee.name_en} ${p.employee.employee_no}`.toLowerCase().includes(query.toLowerCase()));
  const pct = (value: string, matrix: string) => (
    <span className="flex flex-col">
      <span dir="ltr" className="num self-start font-semibold">{format.number(value, [0, 2])}%</span>
      {value !== matrix && <span className="num text-xs text-muted">{t("performance.compensation.byMatrix", { pct: format.number(matrix, [0, 2]) })}</span>}
    </span>
  );
  const columns: Column<Proposal>[] = [
    { id: "employee", header: t("performance.compensation.employee"), cell: (p) => <span className="flex flex-col"><span className="font-semibold text-ink">{format.name(p.employee)}</span><span className="num text-sm text-muted">{p.employee.employee_no}{p.employee.department && ` · ${format.name(p.employee.department)}`}</span></span> },
    { id: "rating", header: t("performance.compensation.rating"), cell: (p) => <span className="flex flex-col"><span className="num font-semibold">{p.level}</span><span className="text-xs text-muted">{t(`performance.compensation.thirds.${p.position}`)}{!p.in_range && ` · ${t("performance.compensation.noRange")}`}</span></span> },
    ...(list.data?.[0]?.current_basic !== undefined ? [{ id: "basic", header: t("performance.compensation.basic"), cell: (p: Proposal) => p.current_basic && <span className="flex flex-col"><Money amount={p.current_basic} />{p.new_basic && <span className="text-xs text-muted">→ <Money amount={p.new_basic} /></span>}</span> }] : []),
    { id: "raise", header: t("performance.compensation.raise"), cell: (p) => <span className="flex flex-col">{pct(p.raise_pct, p.matrix_raise_pct)}{p.raise_amount && <Money className="text-sm text-muted" amount={p.raise_amount} />}</span> },
    { id: "bonus", header: t("performance.compensation.bonus"), cell: (p) => <span className="flex flex-col">{pct(p.bonus_pct, p.matrix_bonus_pct)}{p.bonus_amount && <Money className="text-sm text-muted" amount={p.bonus_amount} />}</span> },
    { id: "note", header: t("performance.compensation.note"), cell: (p) => <span className="text-sm">{p.note || (p.adjusted_by ? t("performance.compensation.adjustedBy", { name: format.name(p.adjusted_by) }) : "")}</span> },
    ...(editable ? [{ id: "edit", header: t("common.actions"), cell: (p: Proposal) => <IconButton size="sm" variant="plain" icon={<Pencil />} label={t("common.editNamed", { name: format.name(p.employee) })} onClick={() => setEditing(p)} /> }] : []),
  ];
  return (
    <Card title={title ?? t("performance.compensation.proposals")} action={<SearchInput label={t("common.search")} value={query} onChange={(e) => setQuery(e.target.value)} />}>
      <DataTable caption={title ?? t("performance.compensation.proposals")} columns={columns} rows={rows} rowKey={(p) => String(p.id)} rowLabel={(p) => p.employee.name_ar} loading={list.isPending} empty={t("performance.compensation.empty")} />
      {editing && <AdjustDialog proposal={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function AdjustDialog({ proposal, onClose }: { proposal: Proposal; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const [v, setV] = useState({ raise_pct: proposal.raise_pct, bonus_pct: proposal.bonus_pct, note: proposal.note });
  const save = useMutation({
    mutationFn: () => compensationApi.adjust(proposal.id, v),
    onSuccess: async () => {
      await Promise.all(["compensation-proposals", "compensation-reviews", "compensation-share"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog open onClose={onClose} title={t("performance.compensation.adjust", { name: format.name(proposal.employee) })} footer={<Button variant="accent" disabled={save.isPending} onClick={() => save.mutate()}>{t("common.save")}</Button>}>
      <div className="flex flex-col gap-4">
        <TextField label={t("performance.compensation.raisePct")} hint={t("performance.compensation.byMatrix", { pct: format.number(proposal.matrix_raise_pct, [0, 2]) })} name="raise_pct" inputMode="decimal" dir="ltr" value={v.raise_pct} onChange={(e) => setV({ ...v, raise_pct: e.target.value })} error={errors.fields.raise_pct} />
        <TextField label={t("performance.compensation.bonusPct")} hint={t("performance.compensation.byMatrix", { pct: format.number(proposal.matrix_bonus_pct, [0, 2]) })} name="bonus_pct" inputMode="decimal" dir="ltr" value={v.bonus_pct} onChange={(e) => setV({ ...v, bonus_pct: e.target.value })} error={errors.fields.bonus_pct} />
        <TextField label={t("performance.compensation.note")} name="note" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} />
        {(errors.fields.detail || errors.general) && <Alert>{errors.fields.detail ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

function TeamProposals() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const open = useQuery({ queryKey: ["compensation-proposals", "open", ...scope], queryFn: () => compensationApi.proposals({ open: "1" }) });
  const first = open.data?.[0];
  const shareOf = useQuery({ queryKey: ["compensation-share", first?.review, ...scope], queryFn: () => compensationApi.share(first!.review), enabled: !!first });
  if (open.isPending) return null;
  if (!first)
    return (
      <Card title={t("performance.compensation.teamTitle")}>
        <p className="text-muted">{t("performance.compensation.nothingOpen")}</p>
      </Card>
    );
  const s = shareOf.data;
  const info = first.review_info;
  return (
    <div className="flex flex-col gap-4">
      <Card title={t("performance.compensation.reviewOf", { cycle: format.name(info.cycle) })} subtitle={t("performance.compensation.teamHint", { date: format.date(info.effective_date) })}>
        {s && s.count > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Bar label={t("performance.compensation.teamRaises")} used={s.raise_used == null ? null : Number(s.raise_used)} total={s.raise_total} budget={s.raise_share} />
            <Bar label={t("performance.compensation.teamBonuses")} used={s.bonus_used == null ? null : Number(s.bonus_used)} total={s.bonus_total} budget={s.bonus_share} />
          </div>
        ) : (
          <p className="text-sm text-muted">{t("performance.compensation.noDirectReports")}</p>
        )}
      </Card>
      <ProposalsCard review={first.review} editable={info.editable} title={t("performance.compensation.teamTitle")} />
    </div>
  );
}
