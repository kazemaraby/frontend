import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { endpoints } from "@/api/index";
import { type Appraisal, type AppraisalForm, appraisalsApi, type AppraisalStep, type Cycle, type Distribution } from "@/api/performance";
import { useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { Dialog } from "@/design/Dialog";
import { FormSelect, TextArea } from "@/design/Field";
import { Pill, type PillTone } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

const STEP_TONES: Record<AppraisalStep, PillTone> = { self: "amber", manager: "sky", calibration: "lavender", released: "teal", acknowledged: "green" };

function formOf(a: Appraisal, side: "self" | "manager"): AppraisalForm {
  return {
    ratings: Object.fromEntries(a.items.map((i) => [String(i.id), { rating: (side === "self" ? i.self_rating : i.manager_rating) ?? null, note: (side === "self" ? i.self_note : i.manager_note) ?? "" }])),
    answers: (side === "self" ? a.self_answers : a.manager_answers) ?? {},
    comment: (side === "self" ? a.self_comment : a.manager_comment) ?? "",
  };
}

/** An appraisal (#123): the items with their weights and the ratings each side may see; the side whose step it is
 * fills its ratings, answers and comment, saves and sends. */
export function AppraisalCard({ appraisal, title }: { appraisal: Appraisal; title: string }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const side: "self" | "manager" | null = appraisal.can.self ? "self" : appraisal.can.manager ? "manager" : null;
  const [v, setV] = useState<AppraisalForm | null>(side ? formOf(appraisal, side) : null);
  const [ack, setAck] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["appraisals"] });
  const save = useMutation({ mutationFn: () => appraisalsApi.save(appraisal.id, side!, v!), onSuccess: refresh });
  const submit = useMutation({
    mutationFn: async () => {
      await appraisalsApi.save(appraisal.id, side!, v!);
      return appraisalsApi.submit(appraisal.id, side!);
    },
    onSuccess: refresh,
  });
  const acknowledge = useMutation({ mutationFn: () => appraisalsApi.acknowledge(appraisal.id, ack), onSuccess: refresh });
  const error = save.error ?? submit.error ?? acknowledge.error;
  const levelName = (value?: number | null) => {
    const level = appraisal.levels.find((l) => l.value === value);
    return level ? `${format.number(level.value)} · ${format.name(level)}` : "—";
  };
  const options = appraisal.levels.map((l) => ({ value: String(l.value), label: `${format.number(l.value)} · ${format.name(l)}` }));
  const setRating = (id: number, patch: Partial<{ rating: number | null; note: string }>) => setV({ ...v!, ratings: { ...v!.ratings, [id]: { ...v!.ratings[id], ...patch } } });
  const released = appraisal.step === "released" || appraisal.step === "acknowledged";
  return (
    <Card
      title={title}
      subtitle={`${format.name(appraisal.employee)}${appraisal.employee.reviewer ? ` · ${t("performance.appraisal.reviewer", { name: format.name(appraisal.employee.reviewer) })}` : ""}`}
      action={<Pill tone={STEP_TONES[appraisal.step]}>{t(`performance.appraisal.steps.${appraisal.step}`)}</Pill>}
    >
      <div className="flex flex-col gap-4">
        {appraisal.self_skipped && <Alert tone="info">{t("performance.appraisal.selfSkipped")}</Alert>}
        {released && appraisal.final_level != null && (
          <p className="rounded-card bg-teal-soft p-4 font-semibold text-teal-ink">
            {t("performance.appraisal.final", { level: levelName(appraisal.final_level) })}
            {appraisal.final_score && <span className="num ms-2 text-sm font-normal">({format.number(appraisal.final_score, [0, 2])})</span>}
          </p>
        )}
        {!released && appraisal.score != null && (
          <p className="text-sm">
            {t("performance.appraisal.score", { score: format.number(appraisal.score, [0, 2]), level: levelName(appraisal.level) })}
            {appraisal.final_level != null && appraisal.final_level !== appraisal.level && <span className="ms-2 font-semibold">{t("performance.appraisal.calibratedTo", { level: levelName(appraisal.final_level) })}</span>}
          </p>
        )}
        <ul className="flex flex-col gap-3">
          {appraisal.items.map((item) => (
            <li key={item.id} className="flex flex-col gap-2 rounded-card bg-neutral-soft p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={item.kind === "goal" ? "sky" : "lavender"}>{t(`performance.appraisal.kinds.${item.kind}`)}</Pill>
                <span className="font-semibold">{format.lang === "en" ? item.title_en || item.title_ar : item.title_ar}</span>
                <span className="num text-sm text-muted">{format.number(item.weight)}%</span>
                {item.progress != null && <span className="num ms-auto text-sm text-muted">{t("performance.appraisal.progress", { value: format.number(item.progress, 0) })}</span>}
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                {item.self_rating !== undefined && side !== "self" && <span>{t("performance.appraisal.selfSaid", { level: levelName(item.self_rating) })}{item.self_note && ` · ${item.self_note}`}</span>}
                {item.manager_rating !== undefined && side !== "manager" && <span>{t("performance.appraisal.managerSaid", { level: levelName(item.manager_rating) })}{item.manager_note && ` · ${item.manager_note}`}</span>}
              </div>
              {side && v && (
                <div className="grid gap-3 sm:grid-cols-[14rem_1fr]">
                  <FormSelect label={t("performance.appraisal.rating")} name={`rating_${item.id}`} placeholder={t("common.choose")} value={v.ratings[item.id]?.rating ? String(v.ratings[item.id].rating) : ""} onChange={(e) => setRating(item.id, { rating: e.target.value ? Number(e.target.value) : null })} options={options} />
                  <TextArea label={t("performance.appraisal.note")} name={`note_${item.id}`} rows={1} value={v.ratings[item.id]?.note ?? ""} onChange={(e) => setRating(item.id, { note: e.target.value })} />
                </div>
              )}
            </li>
          ))}
        </ul>
        {appraisal.questions.map((q) => {
          const own = side && v ? v.answers[q.key] ?? "" : "";
          const theirs = [appraisal.self_answers?.[q.key] && side !== "self" ? [t("performance.appraisal.selfAnswer"), appraisal.self_answers[q.key]] : null, appraisal.manager_answers?.[q.key] && side !== "manager" ? [t("performance.appraisal.managerAnswer"), appraisal.manager_answers[q.key]] : null].filter(Boolean) as [string, string][];
          return (
            <div key={q.key} className="flex flex-col gap-1">
              <p className="font-medium">{format.lang === "en" ? q.text_en || q.text_ar : q.text_ar}</p>
              {theirs.map(([who, text]) => (
                <p key={who} className="text-sm text-muted">
                  {who}: {text}
                </p>
              ))}
              {side && v && <TextArea label={t("performance.appraisal.yourAnswer")} name={`answer_${q.key}`} rows={2} value={own} onChange={(e) => setV({ ...v, answers: { ...v.answers, [q.key]: e.target.value } })} />}
            </div>
          );
        })}
        {side && v && <TextArea label={t("performance.appraisal.comment")} name="comment" rows={2} value={v.comment} onChange={(e) => setV({ ...v, comment: e.target.value })} />}
        {!side && appraisal.manager_comment && <p className="text-sm">{t("performance.appraisal.managerComment", { text: appraisal.manager_comment })}</p>}
        {error && <Alert>{Object.values(apiErrors(error, "").fields)[0] ?? apiErrors(error, t("common.saveFailed")).general}</Alert>}
        {side && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={save.isPending} onClick={() => save.mutate()}>
              {t("performance.appraisal.save")}
            </Button>
            <Button variant="accent" disabled={submit.isPending} onClick={() => submit.mutate()}>
              {t(side === "self" ? "performance.appraisal.sendSelf" : "performance.appraisal.sendManager")}
            </Button>
          </div>
        )}
        {appraisal.can.acknowledge && (
          <div className="flex flex-col gap-2 rounded-card border border-line p-3">
            <TextArea label={t("performance.appraisal.yourComment")} name="ack_comment" rows={2} value={ack} onChange={(e) => setAck(e.target.value)} />
            <Button variant="accent" className="self-start" disabled={acknowledge.isPending} onClick={() => acknowledge.mutate()}>
              {t("performance.appraisal.acknowledge")}
            </Button>
          </div>
        )}
        {appraisal.step === "acknowledged" && <p className="text-sm text-muted">{t("performance.appraisal.acknowledged", { date: format.date(appraisal.acknowledged_at!) })}</p>}
      </div>
    </Card>
  );
}

export function MyAppraisal({ cycle }: { cycle: Cycle }) {
  const { t } = useTranslation();
  const list = useQuery({ queryKey: ["appraisals", "mine", cycle.id], queryFn: () => appraisalsApi.list({ cycle: cycle.id, mine: "1" }) });
  const mine = list.data?.results[0];
  if (list.isPending) return <p className="text-muted">{t("common.loading")}</p>;
  if (!mine) return <Card><p className="text-muted">{t("performance.appraisal.notYet", { date: cycle.self_from })}</p></Card>;
  return <AppraisalCard key={`${mine.id}-${mine.step}`} appraisal={mine} title={t("performance.appraisal.mine")} />;
}

export function Reviews({ cycle }: { cycle: Cycle }) {
  const { t } = useTranslation();
  const format = useFormat();
  const list = useQuery({ queryKey: ["appraisals", "reviews", cycle.id], queryFn: () => appraisalsApi.list({ cycle: cycle.id, reviews: "1" }) });
  const [open, setOpen] = useState<number | null>(null);
  const chosen = list.data?.results.find((a) => a.id === open);
  return (
    <div className="flex flex-col gap-4">
      <Card title={t("performance.appraisal.reviews")}>
        {list.isSuccess && list.data.results.length === 0 ? (
          <p className="text-muted">{t("performance.appraisal.noReviews")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(list.data?.results ?? []).map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => setOpen(a.id)} className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-tile p-3 text-start ${open === a.id ? "bg-teal-soft" : "bg-white hover:bg-neutral-soft"}`}>
                  <span className="font-medium">{format.name(a.employee)} <span className="num text-muted">({a.employee.employee_no})</span></span>
                  <Pill tone={STEP_TONES[a.step]}>{t(`performance.appraisal.steps.${a.step}`)}</Pill>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {chosen && <AppraisalCard key={`${chosen.id}-${chosen.step}`} appraisal={chosen} title={t("performance.appraisal.theirs", { name: format.name(chosen.employee) })} />}
    </div>
  );
}

/** Calibration (HR, performance.calibrate): the managers' ratings and the final ones side by side, per department;
 * a final rating changed with its reason; the release. */
export function Calibration({ cycle }: { cycle: Cycle }) {
  const { t } = useTranslation();
  const format = useFormat();
  const { can } = useSession();
  const queryClient = useQueryClient();
  const departments = useQuery({ queryKey: ["departments"], queryFn: endpoints.departments });
  const [department, setDepartment] = useState("");
  const spread = useQuery({ queryKey: ["appraisals", "distribution", cycle.id, department], queryFn: () => appraisalsApi.distribution(cycle.id, department ? Number(department) : undefined) });
  const [calibrating, setCalibrating] = useState<Distribution["rows"][number] | null>(null);
  const start = useMutation({ mutationFn: () => appraisalsApi.start(cycle.id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["appraisals"] }) });
  const release = useMutation({ mutationFn: () => appraisalsApi.release(cycle.id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["appraisals"] }) });
  const d = spread.data;
  const most = d ? Math.max(1, ...Object.values(d.managers), ...Object.values(d.final)) : 1;
  const columns: Column<Distribution["rows"][number]>[] = [
    { id: "name", header: t("performance.appraisal.employee"), cell: (r) => <span className="flex flex-col"><span className="font-semibold text-ink">{format.name(r.employee)}</span><span className="text-sm text-muted">{r.department}</span></span> },
    { id: "step", header: t("performance.appraisal.step"), cell: (r) => <Pill tone={STEP_TONES[r.step]}>{t(`performance.appraisal.steps.${r.step}`)}</Pill> },
    { id: "score", header: t("performance.appraisal.managerScore"), cell: (r) => <span className="num">{r.score ? `${format.number(r.score, [0, 2])} → ${format.number(r.level ?? 0)}` : "—"}</span> },
    { id: "final", header: t("performance.appraisal.finalRating"), cell: (r) => <span className={`num ${r.changed ? "font-semibold text-teal-dark" : ""}`}>{r.final_level ? format.number(r.final_level) : "—"}</span> },
    { id: "act", header: t("performance.appraisal.calibrate"), cell: (r) => r.step === "calibration" && <Button size="sm" variant="outline" onClick={() => setCalibrating(r)}>{t("performance.appraisal.calibrate")}</Button> },
  ];
  return (
    <Card
      title={t("performance.appraisal.calibrationTitle")}
      action={
        <div className="flex flex-wrap items-end gap-2">
          <FormSelect label={t("performance.goals.department")} name="department" className="w-52" value={department} onChange={(e) => setDepartment(e.target.value)} options={[{ value: "", label: t("performance.appraisal.allDepartments") }, ...(departments.data?.results ?? []).map((x) => ({ value: String(x.id), label: format.name(x) }))]} />
          {can("performance.manage") && <Button variant="outline" disabled={start.isPending} onClick={() => start.mutate()}>{t("performance.appraisal.start")}</Button>}
          <Button variant="accent" disabled={release.isPending || !d?.steps.calibration} onClick={() => release.mutate()}>{t("performance.appraisal.release")}</Button>
        </div>
      }
    >
      {start.isSuccess && <Alert tone="info" className="mb-3">{t("performance.appraisal.started", { count: start.data.made })}</Alert>}
      {release.isSuccess && <Alert tone="info" className="mb-3">{t("performance.appraisal.releasedCount", { count: release.data.released, open: release.data.still_open })}</Alert>}
      {(start.error || release.error) && <Alert className="mb-3">{apiErrors(start.error ?? release.error, t("common.saveFailed")).fields.detail ?? apiErrors(start.error ?? release.error, t("common.saveFailed")).general}</Alert>}
      {d && (
        <section aria-label={t("performance.appraisal.distribution")} className="mb-5 grid gap-2">
          {d.levels.map((lv) => (
            <div key={lv.value} className="grid grid-cols-[10rem_1fr] items-center gap-3 text-sm">
              <span>{`${format.number(lv.value)} · ${format.name(lv)}`}</span>
              <span className="flex flex-col gap-1">
                <span className="h-2.5 rounded-full bg-sky-200" style={{ width: `${(d.managers[lv.value] / most) * 100}%`, minWidth: d.managers[lv.value] ? "0.5rem" : 0 }} title={t("performance.appraisal.managersCount", { count: d.managers[lv.value] })} />
                <span className="h-2.5 rounded-full bg-teal-dark" style={{ width: `${(d.final[lv.value] / most) * 100}%`, minWidth: d.final[lv.value] ? "0.5rem" : 0 }} title={t("performance.appraisal.finalCount", { count: d.final[lv.value] })} />
              </span>
            </div>
          ))}
          <p className="flex gap-4 text-xs text-muted">
            <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-full bg-sky-200" /> {t("performance.appraisal.managersLegend")}</span>
            <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-full bg-teal-dark" /> {t("performance.appraisal.finalLegend")}</span>
          </p>
        </section>
      )}
      <DataTable caption={t("performance.appraisal.calibrationTitle")} columns={columns} rows={d?.rows ?? []} rowKey={(r) => String(r.id)} loading={spread.isPending} empty={t("performance.appraisal.noneYet")} />
      {calibrating && d && <CalibrateDialog row={calibrating} levels={d.levels} onClose={() => setCalibrating(null)} />}
    </Card>
  );
}

function CalibrateDialog({ row, levels, onClose }: { row: Distribution["rows"][number]; levels: Distribution["levels"]; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const [level, setLevel] = useState(String(row.final_level ?? row.level ?? ""));
  const [reason, setReason] = useState("");
  const save = useMutation({
    mutationFn: () => appraisalsApi.calibrate(row.id, Number(level), reason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["appraisals"] });
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog open onClose={onClose} title={`${t("performance.appraisal.calibrate")} · ${format.name(row.employee)}`} footer={<Button variant="accent" disabled={save.isPending || !level} onClick={() => save.mutate()}>{t("common.save")}</Button>}>
      <div className="flex flex-col gap-4">
        <p className="text-sm">{t("performance.appraisal.managerGave", { score: format.number(row.score ?? "0", [0, 2]), level: format.number(row.level ?? 0) })}</p>
        <FormSelect label={t("performance.appraisal.finalRating")} name="final_level" value={level} onChange={(e) => setLevel(e.target.value)} options={levels.map((l) => ({ value: String(l.value), label: `${format.number(l.value)} · ${format.name(l)}` }))} error={errors.fields.final_level} />
        <TextArea label={t("performance.appraisal.reason")} hint={t("performance.appraisal.reasonHint")} name="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} error={errors.fields.reason} />
        {(errors.fields.detail || errors.general) && <Alert>{errors.fields.detail ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
