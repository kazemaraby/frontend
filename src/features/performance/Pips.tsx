import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { endpoints } from "@/api/index";
import { type Pip, type PipBody, pipsApi, type PipStatus } from "@/api/performance";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { DateInput } from "@/design/DateInput";
import { Dialog } from "@/design/Dialog";
import { CheckField, FormSelect, TextArea } from "@/design/Field";
import { Pill, type PillTone } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

const STATUS_TONES: Record<PipStatus, PillTone> = { draft: "amber", active: "orange", closed: "neutral" };

/** Improvement plans (#125): a manager's for their team (performance.manage_pip), the employee's own once issued,
 * HR closes them. */
export function PipsCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const { can } = useSession();
  const scope = useScopeKey();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ["pips", ...scope], queryFn: pipsApi.list });
  const [editing, setEditing] = useState<Pip | "new" | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const remove = useMutation({ mutationFn: (id: number) => pipsApi.remove(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pips"] }) });
  const chosen = list.data?.results.find((p) => p.id === open);
  const columns: Column<Pip>[] = [
    { id: "employee", header: t("performance.pips.employee"), cell: (p) => <span className="flex flex-col"><span className="font-semibold text-ink">{format.name(p.info.employee)}</span><span className="text-sm text-muted">{p.info.owner ? t("performance.pips.ownedBy", { name: format.name(p.info.owner) }) : ""}</span></span> },
    { id: "dates", header: t("performance.pips.period"), cell: (p) => <span className="num text-sm">{format.dateRange(p.start_date, p.end_date)}</span> },
    { id: "status", header: t("performance.pips.status"), cell: (p) => <span className="flex flex-wrap gap-1"><Pill tone={STATUS_TONES[p.status]}>{t(`performance.pips.statuses.${p.status}`)}</Pill>{p.outcome && <Pill tone="neutral">{t(`performance.pips.outcomes.${p.outcome}`)}</Pill>}{p.status === "active" && !p.acknowledged_at && <Pill tone="amber">{t("performance.pips.notAcknowledged")}</Pill>}</span> },
    { id: "open", header: t("performance.pips.plan"), cell: (p) => (
        <span className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={() => setOpen(p.id)}>{t("common.view")}</Button>
          {p.info.can.edit && <IconButton size="sm" variant="plain" icon={<Pencil />} label={t("common.editNamed", { name: format.name(p.info.employee) })} onClick={() => setEditing(p)} />}
          {p.info.can.edit && <IconButton size="sm" variant="danger" icon={<Trash2 />} label={t("common.deleteNamed", { name: format.name(p.info.employee) })} onClick={() => remove.mutate(p.id)} />}
        </span>
      ) },
  ];
  return (
    <div className="flex flex-col gap-4">
      <Card title={t("performance.pips.title")} action={can("performance.manage_pip") && <Button variant="accent" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>{t("performance.pips.add")}</Button>}>
        <DataTable caption={t("performance.pips.title")} columns={columns} rows={list.data?.results ?? []} rowKey={(p) => String(p.id)} rowLabel={(p) => p.info.employee.name_ar} loading={list.isPending} empty={t("performance.pips.empty")} />
      </Card>
      {chosen && <PipDetail pip={chosen} />}
      {editing !== null && <PipDialog row={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function PipDetail({ pip }: { pip: Pip }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [onTrack, setOnTrack] = useState(true);
  const [note, setNote] = useState("");
  const [closing, setClosing] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["pips"] });
  const issue = useMutation({ mutationFn: () => pipsApi.issue(pip.id), onSuccess: refresh });
  const acknowledge = useMutation({ mutationFn: () => pipsApi.acknowledge(pip.id, comment), onSuccess: refresh });
  const checkIn = useMutation({ mutationFn: () => pipsApi.checkIn(pip.id, onTrack, note), onSuccess: async () => { setNote(""); await refresh(); } });
  const error = issue.error ?? acknowledge.error ?? checkIn.error;
  const can = pip.info.can;
  return (
    <Card title={t("performance.pips.planOf", { name: format.name(pip.info.employee) })} subtitle={format.dateRange(pip.start_date, pip.end_date)} action={<Pill tone={STATUS_TONES[pip.status]}>{t(`performance.pips.statuses.${pip.status}`)}</Pill>}>
      <div className="flex flex-col gap-4">
        <p className="whitespace-pre-line">{pip.reason}</p>
        <section aria-label={t("performance.pips.objectives")} className="flex flex-col gap-2">
          <h3 className="font-semibold">{t("performance.pips.objectives")}</h3>
          {pip.objectives.map((o) => (
            <div key={o.id} className="rounded-card bg-neutral-soft p-3 text-sm">
              <p className="font-medium">{o.description}</p>
              <p className="text-muted">{t("performance.pips.successIs", { text: o.success })}</p>
              {o.support && <p className="text-muted">{t("performance.pips.supportIs", { text: o.support })}</p>}
              <p className="num text-muted">{t("performance.pips.dueOn", { date: format.date(o.due_date) })}</p>
            </div>
          ))}
        </section>
        {pip.acknowledged_at && <p className="text-sm text-muted">{t("performance.pips.acknowledgedOn", { date: format.date(pip.acknowledged_at) })}{pip.employee_comment && ` · ${pip.employee_comment}`}</p>}
        {pip.check_ins.length > 0 && (
          <section aria-label={t("performance.pips.checkIns")} className="flex flex-col gap-1 text-sm">
            <h3 className="font-semibold">{t("performance.pips.checkIns")}</h3>
            {pip.check_ins.map((c) => (
              <p key={c.id}>
                <span className="num text-muted">{format.date(c.at, "short")}</span> · <Pill tone={c.on_track ? "green" : "salmon"}>{c.on_track ? t("performance.pips.onTrack") : t("performance.pips.offTrack")}</Pill> {c.note}
              </p>
            ))}
          </section>
        )}
        {pip.outcome && <Alert tone={pip.outcome === "ended" ? "warning" : "info"}>{t(`performance.pips.outcomes.${pip.outcome}`)}{pip.outcome_note && ` · ${pip.outcome_note}`}</Alert>}
        {can.issue && <Button variant="accent" className="self-start" disabled={issue.isPending} onClick={() => issue.mutate()}>{t("performance.pips.issue")}</Button>}
        {can.acknowledge && (
          <div className="flex flex-col gap-2 rounded-card border border-line p-3">
            <TextArea label={t("performance.pips.yourComment")} name="ack_comment" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
            <Button variant="accent" className="self-start" disabled={acknowledge.isPending} onClick={() => acknowledge.mutate()}>{t("performance.pips.acknowledge")}</Button>
          </div>
        )}
        {can.check_in && (
          <div className="flex flex-col gap-2 rounded-card border border-line p-3">
            <CheckField label={t("performance.pips.onTrack")} checked={onTrack} onChange={(e) => setOnTrack(e.target.checked)} />
            <TextArea label={t("performance.pips.howItGoes")} name="check_in_note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            <Button variant="outline" className="self-start" disabled={checkIn.isPending || !note.trim()} onClick={() => checkIn.mutate()}>{t("performance.pips.addCheckIn")}</Button>
          </div>
        )}
        {can.close && <Button variant="primary" className="self-start" onClick={() => setClosing(true)}>{t("performance.pips.close")}</Button>}
        {error && <Alert>{Object.values(apiErrors(error, "").fields)[0] ?? apiErrors(error, t("common.saveFailed")).general}</Alert>}
      </div>
      {closing && <CloseDialog pip={pip} onClose={() => setClosing(false)} />}
    </Card>
  );
}

function CloseDialog({ pip, onClose }: { pip: Pip; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [outcome, setOutcome] = useState("");
  const [note, setNote] = useState("");
  const [until, setUntil] = useState<string | null>(null);
  const close = useMutation({ mutationFn: () => pipsApi.close(pip.id, outcome, note, until), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pips"] }) });
  const errors = apiErrors(close.error, t("common.saveFailed"));
  if (close.data)
    return (
      <Dialog open onClose={onClose} title={t("performance.pips.close")}>
        <div className="flex flex-col gap-3">
          <p role="status">{t(`performance.pips.outcomes.${close.data.outcome || "extended"}`)}</p>
          {close.data.suggest_offboarding && (
            <Alert tone="warning">
              {t("performance.pips.offboardingHint")}{" "}
              <Link to={`/employees/${close.data.employee}`} className="font-semibold underline">{t("performance.pips.openFile")}</Link>
            </Alert>
          )}
        </div>
      </Dialog>
    );
  return (
    <Dialog open onClose={onClose} title={t("performance.pips.close")} footer={<Button variant="accent" disabled={!outcome || !note.trim() || close.isPending} onClick={() => close.mutate()}>{t("common.save")}</Button>}>
      <div className="flex flex-col gap-4">
        <FormSelect label={t("performance.pips.outcome")} name="outcome" placeholder={t("common.choose")} value={outcome} onChange={(e) => setOutcome(e.target.value)} options={(["succeeded", "extended", "ended"] as const).map((o) => ({ value: o, label: t(`performance.pips.outcomes.${o}`) }))} error={errors.fields.outcome} />
        {outcome === "extended" && <DateInput label={t("performance.pips.newEnd")} name="until" value={until} onChange={setUntil} error={errors.fields.until} />}
        <TextArea label={t("performance.pips.reasonNote")} name="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} error={errors.fields.note} />
        {(errors.fields.detail || errors.general) && <Alert>{errors.fields.detail ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

function PipDialog({ row, onClose }: { row: Pip | null; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const people = useQuery({ queryKey: ["employees", "active-all"], queryFn: () => endpoints.employees({ status: "active", page_size: 200 }) });
  const [v, setV] = useState<PipBody>(row ? { employee: row.employee, reason: row.reason, start_date: row.start_date, end_date: row.end_date, objectives: row.objectives } : { employee: null, reason: "", start_date: "", end_date: "", objectives: [{ description: "", success: "", support: "", due_date: "" }] });
  const save = useMutation({
    mutationFn: () => pipsApi.save({ ...v, id: row?.id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pips"] });
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const setObjective = (i: number, patch: Partial<PipBody["objectives"][number]>) => setV({ ...v, objectives: v.objectives.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  return (
    <Dialog open onClose={onClose} size="lg" title={row ? t("performance.pips.edit") : t("performance.pips.add")} footer={<Button variant="accent" disabled={save.isPending || !v.employee || !v.reason.trim() || !v.start_date || !v.end_date} onClick={() => save.mutate()}>{t("common.save")}</Button>}>
      <div className="flex flex-col gap-4">
        {!row && <FormSelect label={t("performance.pips.employee")} name="employee" placeholder={t("common.choose")} value={v.employee ? String(v.employee) : ""} onChange={(e) => setV({ ...v, employee: e.target.value ? Number(e.target.value) : null })} options={(people.data?.results ?? []).map((p) => ({ value: String(p.id), label: `${format.name(p)} (${p.employee_no})` }))} error={errors.fields.employee} />}
        <TextArea label={t("performance.pips.reason")} name="reason" rows={3} value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} error={errors.fields.reason} />
        <div className="grid gap-4 sm:grid-cols-2">
          <DateInput label={t("performance.pips.from")} name="start_date" value={v.start_date || null} onChange={(d) => setV({ ...v, start_date: d ?? "" })} error={errors.fields.start_date} />
          <DateInput label={t("performance.pips.until")} name="end_date" value={v.end_date || null} onChange={(d) => setV({ ...v, end_date: d ?? "" })} error={errors.fields.end_date} />
        </div>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-medium text-ink">{t("performance.pips.objectives")}</legend>
          {v.objectives.map((o, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-card bg-neutral-soft p-3">
              <div className="flex items-start gap-2">
                <TextArea className="flex-1" label={t("performance.pips.whatToImprove")} name={`objective_${i}`} rows={2} value={o.description} onChange={(e) => setObjective(i, { description: e.target.value })} />
                <IconButton label={t("common.delete")} variant="danger" className="mt-7" icon={<Trash2 className="size-4" />} onClick={() => setV({ ...v, objectives: v.objectives.filter((_, j) => j !== i) })} />
              </div>
              <TextArea label={t("performance.pips.success")} name={`success_${i}`} rows={1} value={o.success} onChange={(e) => setObjective(i, { success: e.target.value })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <TextArea label={t("performance.pips.support")} name={`support_${i}`} rows={1} value={o.support} onChange={(e) => setObjective(i, { support: e.target.value })} />
                <DateInput label={t("performance.pips.due")} name={`due_${i}`} value={o.due_date || null} onChange={(d) => setObjective(i, { due_date: d ?? "" })} />
              </div>
            </div>
          ))}
          <Button size="sm" variant="outline" className="self-start" icon={<Plus className="size-4" />} onClick={() => setV({ ...v, objectives: [...v.objectives, { description: "", success: "", support: "", due_date: "" }] })}>
            {t("performance.pips.addObjective")}
          </Button>
          {errors.fields.objectives && <p className="text-sm text-danger">{t("performance.pips.objectivesError")}</p>}
        </fieldset>
        {(errors.fields.detail || errors.general) && <Alert>{errors.fields.detail ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
