import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { endpoints } from "@/api/index";
import { type Cycle, type DepartmentGoal, type Goal, type GoalBody, goalsApi, type Measure, performance, type SheetStatus } from "@/api/performance";
import { useScopeKey } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { DateInput } from "@/design/DateInput";
import { Dialog } from "@/design/Dialog";
import { FormSelect, TextArea, TextField } from "@/design/Field";
import { Pill, type PillTone } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

const MEASURES: Measure[] = ["up", "down", "done"];
export const SHEET_TONES: Record<SheetStatus, PillTone> = { empty: "neutral", draft: "amber", submitted: "sky", agreed: "green" };

/** The active cycles to pick from (the first by default). */
export function useCycles() {
  const scope = useScopeKey();
  const list = useQuery({ queryKey: ["appraisal-cycles", ...scope], queryFn: performance.cycles.list });
  return (list.data?.results ?? []).filter((c) => c.status === "active");
}

export function CyclePicker({ cycles, value, onChange }: { cycles: Cycle[]; value: number | null; onChange: (id: number) => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  return <FormSelect label={t("performance.goals.cycle")} name="cycle" className="w-64" value={value ? String(value) : ""} onChange={(e) => onChange(Number(e.target.value))} options={cycles.map((c) => ({ value: String(c.id), label: format.name(c) }))} />;
}

function Progress({ value }: { value: string }) {
  const percent = Math.max(0, Math.min(100, Number(value)));
  return (
    <span className="flex min-w-28 items-center gap-2">
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-soft" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <span className="block h-full rounded-full bg-teal-dark" style={{ width: `${percent}%` }} />
      </span>
      <span className="num text-sm">{Math.round(percent)}%</span>
    </span>
  );
}

/** One person's goals in a cycle (#121): their total weight, status, adding and changing while goals are set,
 * sending them to the manager, the manager agreeing or sending back, and progress on agreed goals. */
export function GoalSheetCard({ cycle, employee, title }: { cycle: Cycle; employee?: number; title: string }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Goal | "new" | null>(null);
  const [checking, setChecking] = useState<Goal | null>(null);
  const [returning, setReturning] = useState(false);
  const key = ["goal-sheet", cycle.id, employee ?? "me"];
  const sheet = useQuery({ queryKey: key, queryFn: () => goalsApi.sheet(cycle.id, employee) });
  const refresh = () => Promise.all(["goal-sheet", "goal-team"].map((k) => queryClient.invalidateQueries({ queryKey: [k] })));
  const act = useMutation({
    mutationFn: async (what: "submit" | "agree") => {
      if (what === "submit") await goalsApi.submit(cycle.id, employee);
      else await goalsApi.agree(cycle.id, sheet.data!.employee.id);
    },
    onSuccess: refresh,
  });
  const remove = useMutation({ mutationFn: (id: number) => goalsApi.remove(id), onSuccess: refresh });
  const s = sheet.data;
  const columns: Column<Goal>[] = [
    {
      id: "title",
      header: t("performance.goals.goal"),
      cell: (g) => (
        <span className="flex flex-col">
          <span className="font-semibold text-ink">{format.lang === "en" ? g.title_en || g.title_ar : g.title_ar}</span>
          {g.parent_title && <span className="text-xs text-muted">{t("performance.goals.from", { title: format.pick(g.parent_title) })}</span>}
        </span>
      ),
    },
    { id: "target", header: t("performance.goals.target"), cell: (g) => <span className="num text-sm">{g.measure === "done" ? t("performance.measures.done") : `${t(`performance.measures.${g.measure}`)} · ${format.number(g.target ?? "0")} ${g.unit}`}</span> },
    { id: "weight", header: t("performance.goals.weight"), cell: (g) => <span className="num">{format.number(g.weight)}%</span> },
    { id: "due", header: t("performance.goals.due"), cell: (g) => <span className="num text-sm">{format.date(g.due_date)}</span> },
    { id: "progress", header: t("performance.goals.progress"), cell: (g) => <Progress value={g.progress} /> },
    {
      id: "checkin",
      header: t("performance.goals.update"),
      cell: (g) =>
        g.status === "agreed" && (
          <Button size="sm" variant="outline" icon={<TrendingUp className="size-4" />} iconPosition="start" onClick={() => setChecking(g)}>
            {t("performance.goals.checkIn")}
          </Button>
        ),
    },
  ];
  const total = Number(s?.total ?? 0);
  const error = act.error ?? remove.error;
  return (
    <Card
      title={title}
      subtitle={s ? `${format.name(s.employee)} · ${t("performance.goals.total", { total: format.number(s.total) })}` : undefined}
      action={
        s && (
          <span className="flex flex-wrap items-center gap-2">
            <Pill tone={SHEET_TONES[s.status]}>{t(`performance.goals.statuses.${s.status}`)}</Pill>
            {s.can_add && (
              <Button size="sm" variant="outline" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
                {t("performance.goals.add")}
              </Button>
            )}
            {s.can_submit && (
              <Button size="sm" variant="accent" disabled={act.isPending || total !== 100} onClick={() => act.mutate("submit")}>
                {t("performance.goals.submit")}
              </Button>
            )}
            {s.can_agree && (
              <>
                <Button size="sm" variant="accent" disabled={act.isPending} onClick={() => act.mutate("agree")}>
                  {t("performance.goals.agree")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setReturning(true)}>
                  {t("performance.goals.sendBack")}
                </Button>
              </>
            )}
          </span>
        )
      }
    >
      {s?.goals.find((g) => g.returned_note) && <Alert tone="warning" className="mb-3">{t("performance.goals.returned", { note: s.goals.find((g) => g.returned_note)!.returned_note })}</Alert>}
      {s && s.status === "draft" && total !== 100 && <Alert tone="info" className="mb-3">{t("performance.goals.mustTotal", { total: format.number(s.total) })}</Alert>}
      <DataTable caption={title} columns={columns} rows={s?.goals ?? []} rowKey={(g) => String(g.id)} rowLabel={(g) => g.title_ar} loading={sheet.isPending} empty={t("performance.goals.empty")} onEdit={(g) => g.can_edit && setEditing(g)} onDelete={(g) => g.can_edit && remove.mutate(g.id)} />
      {error && <Alert className="mt-3">{Object.values(apiErrors(error, "").fields)[0] ?? apiErrors(error, t("common.saveFailed")).general}</Alert>}
      {editing !== null && <GoalDialog cycle={cycle} employee={employee} row={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={refresh} />}
      {checking && <CheckInDialog goal={checking} onClose={() => setChecking(null)} onSaved={refresh} />}
      {returning && s && <SendBackDialog cycle={cycle} employee={s.employee.id} onClose={() => setReturning(false)} onSaved={refresh} />}
    </Card>
  );
}

function GoalDialog({ cycle, employee, row, onClose, onSaved }: { cycle: Cycle; employee?: number; row: Goal | null; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const { t } = useTranslation();
  const [v, setV] = useState<GoalBody>(row ?? { cycle: cycle.id, employee, title_ar: "", title_en: "", description: "", measure: "up", unit: "", baseline: "0", target: "", weight: "", due_date: cycle.period_end });
  const save = useMutation({
    mutationFn: () => goalsApi.save({ ...v, target: v.measure === "done" ? null : v.target, id: row?.id }),
    onSuccess: async () => {
      await onSaved();
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog open onClose={onClose} title={row ? t("performance.goals.edit") : t("performance.goals.add")} footer={<Button variant="accent" disabled={save.isPending || !v.title_ar || !v.weight} onClick={() => save.mutate()}>{t("common.save")}</Button>}>
      <div className="flex flex-col gap-4">
        <TextField label={t("performance.goals.titleAr")} name="title_ar" value={v.title_ar} onChange={(e) => setV({ ...v, title_ar: e.target.value })} error={errors.fields.title_ar} />
        <TextField label={t("performance.goals.titleEn")} name="title_en" dir="ltr" value={v.title_en} onChange={(e) => setV({ ...v, title_en: e.target.value })} />
        <TextArea label={t("performance.goals.description")} name="description" rows={2} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormSelect label={t("performance.goals.measure")} name="measure" value={v.measure} onChange={(e) => setV({ ...v, measure: e.target.value as Measure })} options={MEASURES.map((m) => ({ value: m, label: t(`performance.measures.${m}`) }))} />
          <TextField label={t("performance.goals.unit")} name="unit" value={v.unit} onChange={(e) => setV({ ...v, unit: e.target.value })} />
          {v.measure !== "done" && (
            <>
              <TextField label={t("performance.goals.baseline")} name="baseline" inputMode="decimal" dir="ltr" value={v.baseline} onChange={(e) => setV({ ...v, baseline: e.target.value })} />
              <TextField label={t("performance.goals.target")} name="target" inputMode="decimal" dir="ltr" value={v.target ?? ""} onChange={(e) => setV({ ...v, target: e.target.value })} error={errors.fields.target} />
            </>
          )}
          <TextField label={t("performance.goals.weight")} name="weight" inputMode="decimal" dir="ltr" value={v.weight} onChange={(e) => setV({ ...v, weight: e.target.value })} error={errors.fields.weight} />
          <DateInput label={t("performance.goals.due")} name="due_date" value={v.due_date || null} onChange={(d) => setV({ ...v, due_date: d ?? "" })} error={errors.fields.due_date} />
        </div>
        {(errors.fields.detail || errors.fields.employee || errors.general) && <Alert>{errors.fields.detail ?? errors.fields.employee ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

function CheckInDialog({ goal, onClose, onSaved }: { goal: Goal; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const { t } = useTranslation();
  const format = useFormat();
  const [value, setValue] = useState(goal.measure === "done" ? "1" : goal.current ?? "");
  const [note, setNote] = useState("");
  const save = useMutation({
    mutationFn: () => goalsApi.checkIn(goal.id, value, note),
    onSuccess: async () => {
      await onSaved();
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog open onClose={onClose} title={`${t("performance.goals.checkIn")} · ${goal.title_ar}`} footer={<Button variant="accent" disabled={save.isPending || value === ""} onClick={() => save.mutate()}>{t("common.save")}</Button>}>
      <div className="flex flex-col gap-4">
        {goal.measure === "done" ? (
          <FormSelect label={t("performance.goals.valueReached")} name="value" value={value} onChange={(e) => setValue(e.target.value)} options={[{ value: "1", label: t("performance.goals.doneYes") }, { value: "0", label: t("performance.goals.doneNo") }]} />
        ) : (
          <TextField label={t("performance.goals.valueReached")} name="value" inputMode="decimal" dir="ltr" value={value} onChange={(e) => setValue(e.target.value)} hint={t("performance.goals.towards", { target: format.number(goal.target ?? "0"), unit: goal.unit })} error={errors.fields.value} />
        )}
        <TextArea label={t("performance.goals.note")} name="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        {goal.check_ins.length > 0 && (
          <ol className="flex flex-col gap-1 text-sm text-muted">
            {goal.check_ins.slice(0, 5).map((c) => (
              <li key={c.id} className="num">
                {format.date(c.at, "short")} · {format.number(c.value)} {c.note && `· ${c.note}`}
              </li>
            ))}
          </ol>
        )}
        {(errors.fields.detail || errors.general) && <Alert>{errors.fields.detail ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

function SendBackDialog({ cycle, employee, onClose, onSaved }: { cycle: Cycle; employee: number; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const { t } = useTranslation();
  const [note, setNote] = useState("");
  const save = useMutation({
    mutationFn: () => goalsApi.sendBack(cycle.id, employee, note),
    onSuccess: async () => {
      await onSaved();
      onClose();
    },
  });
  return (
    <Dialog open onClose={onClose} title={t("performance.goals.sendBack")} footer={<Button variant="accent" disabled={!note.trim() || save.isPending} onClick={() => save.mutate()}>{t("performance.goals.sendBack")}</Button>}>
      <TextArea label={t("performance.goals.whatToChange")} name="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} error={apiErrors(save.error, "").fields.note} />
    </Dialog>
  );
}

/** The people whose goals the user sets (a manager's team; HR's scope), each with the status of their goals. */
export function TeamGoals({ cycle }: { cycle: Cycle }) {
  const { t } = useTranslation();
  const format = useFormat();
  const team = useQuery({ queryKey: ["goal-team", cycle.id], queryFn: () => goalsApi.team(cycle.id) });
  const [open, setOpen] = useState<number | null>(null);
  const person = team.data?.find((p) => p.id === open);
  return (
    <div className="flex flex-col gap-4">
      <Card title={t("performance.goals.team")}>
        {team.isSuccess && team.data.length === 0 ? (
          <p className="text-muted">{t("performance.goals.noTeam")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(team.data ?? []).map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => setOpen(p.id)} className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-tile p-3 text-start ${open === p.id ? "bg-teal-soft" : "bg-white hover:bg-neutral-soft"}`}>
                  <span className="font-medium">
                    {format.name(p)} <span className="num text-muted">({p.employee_no})</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="num text-sm text-muted">{format.number(p.total)}%</span>
                    <Pill tone={SHEET_TONES[p.status]}>{t(`performance.goals.statuses.${p.status}`)}</Pill>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {person && <GoalSheetCard cycle={cycle} employee={person.id} title={t("performance.goals.theirGoals", { name: format.name(person) })} />}
    </div>
  );
}

/** A department's goals for a cycle, given to its people (HR). */
export function DepartmentGoalsCard({ cycle }: { cycle: Cycle }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const departments = useQuery({ queryKey: ["departments"], queryFn: endpoints.departments });
  const list = useQuery({ queryKey: ["department-goals", cycle.id], queryFn: () => goalsApi.departmentGoals(cycle.id) });
  const [editing, setEditing] = useState<DepartmentGoal | "new" | null>(null);
  const [cascading, setCascading] = useState<DepartmentGoal | null>(null);
  const remove = useMutation({ mutationFn: (id: number) => goalsApi.removeDepartmentGoal(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["department-goals"] }) });
  const deptName = (id: number) => {
    const d = departments.data?.results.find((x) => x.id === id);
    return d ? format.name(d) : "";
  };
  const columns: Column<DepartmentGoal>[] = [
    { id: "title", header: t("performance.goals.goal"), cell: (g) => <span className="flex flex-col"><span className="font-semibold text-ink">{format.lang === "en" ? g.title_en || g.title_ar : g.title_ar}</span><span className="text-sm text-muted">{deptName(g.department)}</span></span> },
    { id: "target", header: t("performance.goals.target"), cell: (g) => <span className="num text-sm">{g.measure === "done" ? t("performance.measures.done") : `${format.number(g.target ?? "0")} ${g.unit}`}</span> },
    { id: "people", header: t("performance.goals.people"), cell: (g) => <span className="num">{format.number(g.goals_count)}</span> },
    { id: "progress", header: t("performance.goals.progress"), cell: (g) => <Progress value={g.progress} /> },
    { id: "cascade", header: t("performance.goals.cascade"), cell: (g) => <Button size="sm" variant="outline" onClick={() => setCascading(g)}>{t("performance.goals.cascade")}</Button> },
  ];
  return (
    <Card title={t("performance.goals.departmentTitle")} action={<Button variant="accent" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>{t("performance.goals.addDepartment")}</Button>}>
      <DataTable caption={t("performance.goals.departmentTitle")} columns={columns} rows={list.data?.results ?? []} rowKey={(g) => String(g.id)} rowLabel={(g) => g.title_ar} loading={list.isPending} empty={t("performance.goals.noDepartmentGoals")} onEdit={(g) => setEditing(g)} onDelete={(g) => remove.mutate(g.id)} />
      {editing !== null && <DepartmentGoalDialog cycle={cycle} row={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {cascading && <CascadeDialog goal={cascading} onClose={() => setCascading(null)} />}
    </Card>
  );
}

function DepartmentGoalDialog({ cycle, row, onClose }: { cycle: Cycle; row: DepartmentGoal | null; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const departments = useQuery({ queryKey: ["departments"], queryFn: endpoints.departments });
  const [v, setV] = useState(row ?? { cycle: cycle.id, department: 0, title_ar: "", title_en: "", measure: "up" as Measure, unit: "", baseline: "0", target: "", due_date: cycle.period_end });
  const save = useMutation({
    mutationFn: () => goalsApi.saveDepartmentGoal({ ...v, target: v.measure === "done" ? null : v.target, id: row?.id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["department-goals"] });
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog open onClose={onClose} title={row ? t("performance.goals.edit") : t("performance.goals.addDepartment")} footer={<Button variant="accent" disabled={save.isPending || !v.title_ar || !v.department} onClick={() => save.mutate()}>{t("common.save")}</Button>}>
      <div className="flex flex-col gap-4">
        <FormSelect label={t("performance.goals.department")} name="department" placeholder={t("common.choose")} value={v.department ? String(v.department) : ""} onChange={(e) => setV({ ...v, department: Number(e.target.value) })} options={(departments.data?.results ?? []).map((d) => ({ value: String(d.id), label: format.name(d) }))} />
        <TextField label={t("performance.goals.titleAr")} name="title_ar" value={v.title_ar} onChange={(e) => setV({ ...v, title_ar: e.target.value })} error={errors.fields.title_ar} />
        <TextField label={t("performance.goals.titleEn")} name="title_en" dir="ltr" value={v.title_en} onChange={(e) => setV({ ...v, title_en: e.target.value })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormSelect label={t("performance.goals.measure")} name="measure" value={v.measure} onChange={(e) => setV({ ...v, measure: e.target.value as Measure })} options={MEASURES.map((m) => ({ value: m, label: t(`performance.measures.${m}`) }))} />
          <TextField label={t("performance.goals.unit")} name="unit" value={v.unit} onChange={(e) => setV({ ...v, unit: e.target.value })} />
          {v.measure !== "done" && <TextField label={t("performance.goals.target")} name="target" inputMode="decimal" dir="ltr" value={v.target ?? ""} onChange={(e) => setV({ ...v, target: e.target.value })} />}
          <DateInput label={t("performance.goals.due")} name="due_date" value={v.due_date || null} onChange={(d) => setV({ ...v, due_date: d ?? "" })} error={errors.fields.due_date} />
        </div>
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

function CascadeDialog({ goal, onClose }: { goal: DepartmentGoal; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [weight, setWeight] = useState("20");
  const run = useMutation({ mutationFn: () => goalsApi.cascade(goal.id, weight), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["department-goals"] }) });
  const errors = apiErrors(run.error, t("common.saveFailed"));
  return (
    <Dialog open onClose={onClose} title={`${t("performance.goals.cascade")} · ${goal.title_ar}`} footer={!run.isSuccess && <Button variant="accent" disabled={run.isPending} onClick={() => run.mutate()}>{t("performance.goals.cascade")}</Button>}>
      {run.isSuccess ? (
        <p role="status">{t("performance.goals.cascaded", { count: run.data.made })}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">{t("performance.goals.cascadeHint")}</p>
          <TextField label={t("performance.goals.weight")} name="weight" inputMode="decimal" dir="ltr" value={weight} onChange={(e) => setWeight(e.target.value)} error={errors.fields.weight} />
          {(errors.fields.detail || errors.general) && <Alert>{errors.fields.detail ?? errors.general}</Alert>}
        </div>
      )}
    </Dialog>
  );
}
