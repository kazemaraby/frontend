import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { endpoints } from "@/api/index";
import { exportsApi } from "@/api/reports";
import { type Course, type CourseBody, type Enrollment, type EnrollmentStatus, type SessionBody, type TrainingBudget, type TrainingRequest, trainingApi } from "@/api/training";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { DateInput } from "@/design/DateInput";
import { Dialog } from "@/design/Dialog";
import { CheckField, FormSelect, TextArea, TextField } from "@/design/Field";
import { FileDrop } from "@/design/FileDrop";
import { Money } from "@/design/Money";
import { Pill, type PillTone } from "@/design/Pill";
import { Tabs } from "@/design/Tabs";
import { ExportButtons } from "@/features/reports/ExportButtons";
import { Page } from "@/layout/Page";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

type Tab = "mine" | "requests" | "catalog" | "enrollments" | "budgets";
const REQUEST_TONES: Record<string, PillTone> = { pending: "amber", approved: "green", rejected: "salmon", returned: "orange", cancelled: "neutral", draft: "neutral" };
const ENROLLMENT_TONES: Record<EnrollmentStatus, PillTone> = { enrolled: "sky", attended: "lavender", completed: "green", no_show: "salmon", cancelled: "neutral" };
const BUDGET_TONES: Record<string, PillTone> = { within: "green", over: "salmon", none: "neutral", "": "neutral" };

/** /training — training (Phase 6 task 19): one's own courses and suggestions, requests (asked for oneself or a
 * manager's nomination, approved through the workflow), the catalog and sessions, enrolments and results (HR), the
 * department budgets. */
export default function TrainingPage() {
  const { t } = useTranslation();
  const { can, me } = useSession();
  const [params, setParams] = useSearchParams();
  const tabs: Tab[] = [
    ...(me?.employee ? (["mine"] as Tab[]) : []),
    "requests",
    "catalog",
    ...(can("training.manage") ? (["enrollments"] as Tab[]) : []),
    ...(can("training.manage_budget") ? (["budgets"] as Tab[]) : []),
  ];
  const asked = params.get("tab") as Tab | null;
  const tab: Tab = asked && tabs.includes(asked) ? asked : tabs[0];
  const [asking, setAsking] = useState<{ course?: Course } | null>(null);
  return (
    <Page
      title={t("training.title")}
      tabs={<Tabs label={t("training.title")} value={tab} onChange={(next) => setParams(next === tabs[0] ? {} : { tab: next }, { replace: true })} items={tabs.map((id) => ({ id, label: t(`training.tabs.${id}`) }))} />}
      actions={<Button variant="accent" icon={<Plus className="size-4" />} onClick={() => setAsking({})}>{t("training.ask")}</Button>}
    >
      {tab === "mine" && <Mine onAsk={(course) => setAsking({ course })} />}
      {tab === "requests" && <Requests />}
      {tab === "catalog" && <Catalog onAsk={(course) => setAsking({ course })} />}
      {tab === "enrollments" && <Enrollments />}
      {tab === "budgets" && <Budgets />}
      {asking && <AskDialog course={asking.course} onClose={() => setAsking(null)} />}
    </Page>
  );
}

function Mine({ onAsk }: { onAsk: (course?: Course) => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const mine = useQuery({ queryKey: ["enrollments", "mine", ...scope], queryFn: () => trainingApi.enrollments({ mine: "1" }) });
  const suggestions = useQuery({ queryKey: ["training-suggestions", ...scope], queryFn: () => trainingApi.suggestions() });
  const courses = useQuery({ queryKey: ["courses", "active", ...scope], queryFn: () => trainingApi.courses(true) });
  const columns: Column<Enrollment>[] = [
    { id: "course", header: t("training.course"), cell: (e) => <span className="font-semibold text-ink">{format.name(e.info.course)}</span> },
    { id: "when", header: t("training.when"), cell: (e) => (e.info.session ? <span className="num text-sm">{format.dateRange(e.info.session.start_date, e.info.session.end_date)}</span> : "—") },
    { id: "status", header: t("training.status"), cell: (e) => <Pill tone={ENROLLMENT_TONES[e.status]}>{t(`training.enrollmentStatuses.${e.status}`)}</Pill> },
    { id: "certificate", header: t("training.certificate"), cell: (e) => (e.info.certificate ? <span className="text-sm">{e.info.certificate.expiry_date ? t("training.expires", { date: format.date(e.info.certificate.expiry_date) }) : t("training.noExpiry")}</span> : "—") },
  ];
  return (
    <div className="flex flex-col gap-4">
      {!!suggestions.data?.length && (
        <Card title={t("training.suggested")} subtitle={t("training.suggestedHint")}>
          <ul className="flex flex-col gap-2">
            {suggestions.data.map((s) => (
              <li key={`${s.course.id}-${s.competency.name_ar}`} className="flex flex-wrap items-center justify-between gap-2 rounded-card bg-white px-4 py-3">
                <span>
                  <span className="font-semibold text-ink">{format.name(s.course)}</span>
                  <span className="text-sm text-muted"> · {t("training.forCompetency", { competency: format.name(s.competency), rating: s.rating, top: s.top })}</span>
                </span>
                <Button size="sm" variant="outline" onClick={() => onAsk(courses.data?.results.find((c) => c.id === s.course.id))}>{t("training.ask")}</Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card title={t("training.myCourses")}>
        <DataTable caption={t("training.myCourses")} columns={columns} rows={mine.data?.results ?? []} rowKey={(e) => String(e.id)} rowLabel={(e) => e.info.course.name_ar} loading={mine.isPending} empty={t("training.noneYet")} />
      </Card>
    </div>
  );
}

function Requests() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const list = useQuery({ queryKey: ["training-requests", ...scope], queryFn: trainingApi.requests });
  const columns: Column<TrainingRequest>[] = [
    { id: "employee", header: t("training.employee"), cell: (r) => <span className="flex flex-col"><span className="font-semibold text-ink">{format.name(r.info.employee)}</span>{r.info.nominated && <span className="text-sm text-muted">{t("training.nominatedBy", { name: format.name(r.info.requester) })}</span>}</span> },
    { id: "course", header: t("training.course"), cell: (r) => <span className="flex flex-col"><span>{format.name(r.info.course)}</span>{r.info.session && <span className="num text-sm text-muted">{format.dateRange(r.info.session.start_date, r.info.session.end_date)}</span>}</span> },
    { id: "cost", header: t("training.cost"), cell: (r) => <span className="flex flex-col gap-1"><Money amount={r.cost} />{r.budget && <Pill tone={BUDGET_TONES[r.budget]}>{t(`training.budgetStatuses.${r.budget}`)}</Pill>}</span> },
    { id: "status", header: t("training.status"), cell: (r) => <Pill tone={REQUEST_TONES[r.status] ?? "neutral"}>{t(`training.requestStatuses.${r.status}`)}</Pill> },
  ];
  return (
    <Card title={t("training.tabs.requests")}>
      <DataTable caption={t("training.tabs.requests")} columns={columns} rows={list.data?.results ?? []} rowKey={(r) => String(r.id)} rowLabel={(r) => r.info.employee.name_ar} loading={list.isPending} empty={t("training.noRequests")} />
    </Card>
  );
}

function Catalog({ onAsk }: { onAsk: (course: Course) => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const { can } = useSession();
  const scope = useScopeKey();
  const list = useQuery({ queryKey: ["courses", "all", ...scope], queryFn: () => trainingApi.courses(!can("training.manage")) });
  const [editing, setEditing] = useState<Course | "new" | null>(null);
  const [planning, setPlanning] = useState<Course | null>(null);
  const columns: Column<Course>[] = [
    { id: "name", header: t("training.course"), cell: (c) => <span className="flex flex-col"><span className="font-semibold text-ink">{format.name(c)}</span><span className="text-sm text-muted">{t(`training.kinds.${c.kind}`)}{c.provider && ` · ${c.provider}`}</span></span> },
    { id: "hours", header: t("training.hours"), cell: (c) => <span className="num">{format.number(c.hours, [0, 1])}</span> },
    { id: "cost", header: t("training.cost"), cell: (c) => <Money amount={c.cost} currency={c.currency} /> },
    { id: "sessions", header: t("training.sessions"), cell: (c) => (c.upcoming.length ? <span className="flex flex-col text-sm">{c.upcoming.map((s) => <span key={s.id} className="num">{format.dateRange(s.start_date, s.end_date)} · {t("training.seatsLeft", { count: s.seats_left })}</span>)}</span> : <span className="text-muted">—</span>) },
    { id: "ask", header: t("training.ask"), cell: (c) => <span className="flex gap-2"><Button size="sm" variant="outline" disabled={!c.is_active} onClick={() => onAsk(c)}>{t("training.ask")}</Button>{can("training.manage") && <Button size="sm" variant="outline" onClick={() => setPlanning(c)}>{t("training.addSession")}</Button>}</span> },
  ];
  return (
    <Card title={t("training.tabs.catalog")} action={can("training.manage") && <Button variant="accent" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>{t("training.addCourse")}</Button>}>
      <DataTable caption={t("training.tabs.catalog")} columns={columns} rows={list.data?.results ?? []} rowKey={(c) => String(c.id)} rowLabel={(c) => c.name_ar} loading={list.isPending} empty={t("training.noCourses")} onEdit={can("training.manage") ? (c) => setEditing(c) : undefined} />
      {editing !== null && <CourseDialog row={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {planning && <SessionDialog course={planning} onClose={() => setPlanning(null)} />}
    </Card>
  );
}

function CourseDialog({ row, onClose }: { row: Course | null; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [v, setV] = useState<CourseBody>(row ?? { code: "", name_ar: "", name_en: "", kind: "internal", provider: "", description: "", hours: "", cost: "", currency: "SAR", competencies: [], certificate_months: null, is_active: true });
  const save = useMutation({ mutationFn: () => trainingApi.saveCourse({ ...v, id: row?.id }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["courses"] }); onClose(); } });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog open onClose={onClose} title={row ? t("training.editCourse") : t("training.addCourse")} footer={<Button variant="accent" disabled={save.isPending} onClick={() => save.mutate()}>{t("common.save")}</Button>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t("training.nameAr")} name="name_ar" value={v.name_ar} onChange={(e) => setV({ ...v, name_ar: e.target.value })} error={errors.fields.name_ar} />
        <TextField label={t("training.nameEn")} name="name_en" dir="ltr" value={v.name_en} onChange={(e) => setV({ ...v, name_en: e.target.value })} />
        <TextField label={t("training.code")} name="code" dir="ltr" value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} error={errors.fields.code} />
        <FormSelect label={t("training.kind")} name="kind" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value as CourseBody["kind"] })} options={(["internal", "external"] as const).map((k) => ({ value: k, label: t(`training.kinds.${k}`) }))} />
        <TextField label={t("training.provider")} name="provider" value={v.provider} onChange={(e) => setV({ ...v, provider: e.target.value })} />
        <TextField label={t("training.hours")} name="hours" inputMode="decimal" dir="ltr" value={v.hours} onChange={(e) => setV({ ...v, hours: e.target.value })} error={errors.fields.hours} />
        <TextField label={t("training.costPer")} name="cost" inputMode="decimal" dir="ltr" value={v.cost} onChange={(e) => setV({ ...v, cost: e.target.value })} error={errors.fields.cost} />
        <TextField label={t("training.certificateMonths")} hint={t("training.certificateMonthsHint")} name="certificate_months" inputMode="numeric" dir="ltr" value={v.certificate_months === null ? "" : String(v.certificate_months)} onChange={(e) => setV({ ...v, certificate_months: e.target.value ? Number(e.target.value) : null })} />
        <TextArea className="sm:col-span-2" label={t("training.description")} name="description" rows={3} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
        <CheckField label={t("training.active")} checked={v.is_active} onChange={(e) => setV({ ...v, is_active: e.target.checked })} />
        {errors.general && <Alert className="sm:col-span-2">{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

function SessionDialog({ course, onClose }: { course: Course; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const [v, setV] = useState<SessionBody>({ course: course.id, start_date: "", end_date: "", seats: 20, trainer: "", place: "", status: "planned" });
  const save = useMutation({ mutationFn: () => trainingApi.saveSession(v), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["courses"] }); onClose(); } });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog open onClose={onClose} title={t("training.sessionOf", { course: format.name(course) })} footer={<Button variant="accent" disabled={save.isPending || !v.start_date || !v.end_date} onClick={() => save.mutate()}>{t("common.save")}</Button>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <DateInput label={t("training.from")} name="start_date" value={v.start_date || null} onChange={(d) => setV({ ...v, start_date: d ?? "" })} error={errors.fields.start_date} />
        <DateInput label={t("training.to")} name="end_date" value={v.end_date || null} onChange={(d) => setV({ ...v, end_date: d ?? "" })} error={errors.fields.end_date} />
        <TextField label={t("training.seats")} name="seats" inputMode="numeric" dir="ltr" value={String(v.seats)} onChange={(e) => setV({ ...v, seats: Number(e.target.value) || 0 })} />
        <TextField label={t("training.trainer")} name="trainer" value={v.trainer} onChange={(e) => setV({ ...v, trainer: e.target.value })} />
        <TextField className="sm:col-span-2" label={t("training.place")} name="place" value={v.place} onChange={(e) => setV({ ...v, place: e.target.value })} />
        {errors.general && <Alert className="sm:col-span-2">{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

function AskDialog({ course, onClose }: { course?: Course; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const { me, can } = useSession();
  const scope = useScopeKey();
  const queryClient = useQueryClient();
  const courses = useQuery({ queryKey: ["courses", "active", ...scope], queryFn: () => trainingApi.courses(true) });
  const team = useQuery({ queryKey: ["employees", "for-training", ...scope], queryFn: () => endpoints.employees({ status: "active", page_size: 100 }), enabled: can("employees.view") });
  const [v, setV] = useState({ employee: me?.employee?.id ?? 0, course: course?.id ?? 0, session: null as number | null, reason: "" });
  const chosen = courses.data?.results.find((c) => c.id === v.course) ?? course;
  const save = useMutation({ mutationFn: () => trainingApi.ask(v), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["training-requests"] }); onClose(); } });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const people = [...(me?.employee ? [{ value: String(me.employee.id), label: t("training.myself") }] : []), ...(team.data?.results ?? []).filter((p) => p.id !== me?.employee?.id).map((p) => ({ value: String(p.id), label: `${format.name(p)} (${p.employee_no})` }))];
  return (
    <Dialog open onClose={onClose} title={t("training.ask")} footer={<Button variant="accent" disabled={save.isPending || !v.employee || !v.course} onClick={() => save.mutate()}>{t("training.send")}</Button>}>
      <div className="flex flex-col gap-4">
        <FormSelect label={t("training.for")} name="employee" value={v.employee ? String(v.employee) : ""} placeholder={t("common.choose")} onChange={(e) => setV({ ...v, employee: Number(e.target.value) })} options={people} error={errors.fields.employee} />
        <FormSelect label={t("training.course")} name="course" value={v.course ? String(v.course) : ""} placeholder={t("common.choose")} onChange={(e) => setV({ ...v, course: Number(e.target.value), session: null })} options={(courses.data?.results ?? []).map((c) => ({ value: String(c.id), label: format.name(c) }))} error={errors.fields.course} />
        {chosen && chosen.upcoming.length > 0 && <FormSelect label={t("training.session")} name="session" value={v.session ? String(v.session) : ""} placeholder={t("training.anySession")} onChange={(e) => setV({ ...v, session: e.target.value ? Number(e.target.value) : null })} options={chosen.upcoming.map((s) => ({ value: String(s.id), label: `${format.dateRange(s.start_date, s.end_date)} · ${t("training.seatsLeft", { count: s.seats_left })}` }))} error={errors.fields.session} />}
        {chosen && <p className="text-sm text-muted">{t("training.costNote", { hours: format.number(chosen.hours, [0, 1]) })} <Money amount={chosen.cost} currency={chosen.currency} /></p>}
        <TextArea label={t("training.why")} name="reason" rows={3} value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} />
        {(errors.fields.detail || errors.general) && <Alert>{errors.fields.detail ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

function Enrollments() {
  const { t } = useTranslation();
  const format = useFormat();
  const { can } = useSession();
  const scope = useScopeKey();
  const list = useQuery({ queryKey: ["enrollments", "all", ...scope], queryFn: () => trainingApi.enrollments() });
  const [recording, setRecording] = useState<Enrollment | null>(null);
  const columns: Column<Enrollment>[] = [
    { id: "employee", header: t("training.employee"), cell: (e) => <span className="flex flex-col"><span className="font-semibold text-ink">{format.name(e.info.employee)}</span><span className="num text-sm text-muted">{e.info.employee.employee_no}</span></span> },
    { id: "course", header: t("training.course"), cell: (e) => <span className="flex flex-col"><span>{format.name(e.info.course)}</span>{e.info.session && <span className="num text-sm text-muted">{format.dateRange(e.info.session.start_date, e.info.session.end_date)}</span>}</span> },
    { id: "status", header: t("training.status"), cell: (e) => <Pill tone={ENROLLMENT_TONES[e.status]}>{t(`training.enrollmentStatuses.${e.status}`)}</Pill> },
    { id: "cost", header: t("training.cost"), cell: (e) => <Money amount={e.cost} /> },
    { id: "certificate", header: t("training.certificate"), cell: (e) => (e.info.certificate ? (e.info.certificate.expiry_date ? <span className="num text-sm">{t("training.expires", { date: format.date(e.info.certificate.expiry_date) })}</span> : t("training.noExpiry")) : "—") },
    { id: "record", header: t("training.record"), cell: (e) => <Button size="sm" variant="outline" disabled={e.status === "completed" || e.status === "cancelled"} onClick={() => setRecording(e)}>{t("training.record")}</Button> },
  ];
  return (
    <Card title={t("training.tabs.enrollments")} action={can("employees.export") && <ExportButtons download={(as) => exportsApi.run("training.records", as)} />}>
      <DataTable caption={t("training.tabs.enrollments")} columns={columns} rows={list.data?.results ?? []} rowKey={(e) => String(e.id)} rowLabel={(e) => e.info.employee.name_ar} loading={list.isPending} empty={t("training.noneYet")} />
      {recording && <RecordDialog enrollment={recording} onClose={() => setRecording(null)} />}
    </Card>
  );
}

function RecordDialog({ enrollment, onClose }: { enrollment: Enrollment; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<EnrollmentStatus>("completed");
  const [completedOn, setCompletedOn] = useState<string | null>(null);
  const [score, setScore] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const save = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append("status", status);
      if (completedOn) form.append("completed_on", completedOn);
      if (score) form.append("score", score);
      if (file && status === "completed") form.append("file", file);
      return trainingApi.record(enrollment.id, form);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog open onClose={onClose} title={t("training.recordFor", { name: format.name(enrollment.info.employee) })} footer={<Button variant="accent" disabled={save.isPending} onClick={() => save.mutate()}>{t("common.save")}</Button>}>
      <div className="flex flex-col gap-4">
        <FormSelect label={t("training.result")} name="status" value={status} onChange={(e) => setStatus(e.target.value as EnrollmentStatus)} options={(["attended", "completed", "no_show", "cancelled"] as const).map((s) => ({ value: s, label: t(`training.enrollmentStatuses.${s}`) }))} error={errors.fields.status} />
        {status === "completed" && (
          <>
            <DateInput label={t("training.completedOn")} name="completed_on" value={completedOn} onChange={setCompletedOn} error={errors.fields.completed_on} />
            <TextField label={t("training.score")} name="score" inputMode="decimal" dir="ltr" value={score} onChange={(e) => setScore(e.target.value)} />
            <FileDrop label={t("training.certificateFile")} file={file} onChange={setFile} accept=".pdf,.jpg,.jpeg,.png" error={errors.fields.file} />
          </>
        )}
        {(errors.fields.detail || errors.general) && <Alert>{errors.fields.detail ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

function Budgets() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const queryClient = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const list = useQuery({ queryKey: ["training-budgets", year, ...scope], queryFn: () => trainingApi.budgets(year) });
  const departments = useQuery({ queryKey: ["departments", ...scope], queryFn: () => endpoints.departments() });
  const [v, setV] = useState({ department: "", amount: "", note: "" });
  const save = useMutation({ mutationFn: () => trainingApi.saveBudget({ year, department: v.department ? Number(v.department) : null, amount: v.amount, note: v.note }), onSuccess: async () => { setV({ department: "", amount: "", note: "" }); await queryClient.invalidateQueries({ queryKey: ["training-budgets"] }); } });
  const remove = useMutation({ mutationFn: (id: number) => trainingApi.removeBudget(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["training-budgets"] }) });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const columns: Column<TrainingBudget>[] = [
    { id: "department", header: t("training.department"), cell: (b) => (b.department_name ? format.name(b.department_name) : t("training.restOfCompany")) },
    { id: "amount", header: t("training.amount"), cell: (b) => <Money amount={b.amount} currency={b.currency} /> },
    { id: "taken", header: t("training.taken"), cell: (b) => <span className={Number(b.taken) > Number(b.amount) ? "font-semibold text-danger" : ""}><Money amount={b.taken} currency={b.currency} /></span> },
  ];
  return (
    <Card title={t("training.tabs.budgets")} action={<TextField className="w-28" label={t("training.year")} name="year" inputMode="numeric" dir="ltr" value={String(year)} onChange={(e) => setYear(Number(e.target.value) || year)} />}>
      <DataTable caption={t("training.tabs.budgets")} columns={columns} rows={list.data?.results ?? []} rowKey={(b) => String(b.id)} rowLabel={(b) => b.department_name?.name_ar ?? t("training.restOfCompany")} loading={list.isPending} empty={t("training.noBudgets")} onDelete={(b) => remove.mutate(b.id)} />
      <div className="mt-4 grid items-end gap-3 sm:grid-cols-4">
        <FormSelect label={t("training.department")} name="budget_department" value={v.department} placeholder={t("training.restOfCompany")} onChange={(e) => setV({ ...v, department: e.target.value })} options={(departments.data?.results ?? []).map((d) => ({ value: String(d.id), label: format.name(d) }))} error={errors.fields.department} />
        <TextField label={t("training.amount")} name="budget_amount" inputMode="decimal" dir="ltr" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} error={errors.fields.amount} />
        <TextField label={t("training.note")} name="budget_note" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} />
        <Button variant="accent" disabled={save.isPending || !v.amount} onClick={() => save.mutate()}>{t("training.addBudget")}</Button>
      </div>
    </Card>
  );
}
