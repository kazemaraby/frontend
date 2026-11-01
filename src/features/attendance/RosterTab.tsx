import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Moon, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { endpoints } from "@/api";
import { attendance, type Assignment, type AssignmentTarget, roster, type RosterDay, type ShiftBrief, shifts } from "@/api/attendance";
import { hr } from "@/api/hr";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { DateInput } from "@/design/DateInput";
import { Dialog } from "@/design/Dialog";
import { FormSelect, SearchInput, TextField } from "@/design/Field";
import { Pagination } from "@/design/Pagination";
import { Pill } from "@/design/Pill";
import { toISODate } from "@/lib/format";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

import { hm } from "./clock";
import { DOTS } from "./ShiftsTab";

const DAY = 86_400_000;
const sunday = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);

type Cell = { employee: { id: number; name_ar: string; name_en: string }; day: RosterDay };

/** The roster (Phase 3 task 3): each person's shift for each day of the week, from the assignments (employee ›
 * group › department › branch › company) and one-day changes; the week's hours against the Labor Law's weekly limit. */
export function RosterTab() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const { can } = useSession();
  const manage = can("attendance.manage");
  const [start, setStart] = useState(() => sunday(new Date()));
  const [filters, setFilters] = useState<{ department?: number; group?: number; search?: string }>({});
  const [cell, setCell] = useState<Cell | null>(null);
  const [assigning, setAssigning] = useState(false);
  const from = toISODate(start);
  const to = toISODate(addDays(start, 6));
  const data = useQuery({ queryKey: ["roster", from, filters, ...scope], queryFn: () => roster.get({ from, to, ...filters }), placeholderData: keepPreviousData });
  const departments = useQuery({ queryKey: ["master", "departments", ...scope], queryFn: endpoints.departments });
  const groups = useQuery({ queryKey: ["employee-groups", ...scope], queryFn: attendance.groups });
  const byId = new Map((data.data?.shifts ?? []).map((s) => [s.id, s]));
  const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const label = (d: RosterDay) => {
    const s = d.shift ? byId.get(d.shift) : undefined;
    if (s) return t("roster.cellShift", { shift: format.name(s), hours: hm(d.minutes) });
    if (d.off) return t(`roster.offWhy.${d.why || "change"}`);
    return t("roster.nothing");
  };

  return (
    <div className="flex flex-col gap-4">
      <Card
        variant="solid"
        title={t("roster.title")}
        subtitle={t("roster.week", { from: format.date(from, "dayMonth"), to: format.date(to, "dayMonthYear") })}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <IconButton size="sm" variant="outline" label={t("roster.previous")} icon={<ChevronRight className="ltr:rotate-180" />} onClick={() => setStart(addDays(start, -7))} />
            <Button size="sm" variant="outline" onClick={() => setStart(sunday(new Date()))}>
              {t("roster.thisWeek")}
            </Button>
            <IconButton size="sm" variant="outline" label={t("roster.next")} icon={<ChevronLeft className="ltr:rotate-180" />} onClick={() => setStart(addDays(start, 7))} />
            {manage && (
              <Button size="sm" variant="accent" icon={<Plus className="size-4" />} onClick={() => setAssigning(true)}>
                {t("roster.assign")}
              </Button>
            )}
          </div>
        }
      >
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <SearchInput label={t("roster.search")} value={filters.search ?? ""} onChange={(e) => setFilters({ ...filters, search: e.target.value || undefined })} />
          <FormSelect label={t("leaveReport.department")} className="[&_label]:sr-only" value={String(filters.department ?? "")} placeholder={t("leaveReport.everyDepartment")} options={(departments.data?.results ?? []).map((d) => ({ value: String(d.id), label: format.name(d) }))} onChange={(e) => setFilters({ ...filters, department: e.target.value ? Number(e.target.value) : undefined })} />
          <FormSelect label={t("roster.group")} className="[&_label]:sr-only" value={String(filters.group ?? "")} placeholder={t("roster.everyGroup")} options={(groups.data ?? []).map((g) => ({ value: String(g.id), label: format.name(g) }))} onChange={(e) => setFilters({ ...filters, group: e.target.value ? Number(e.target.value) : undefined })} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-separate border-spacing-y-1.5 text-sm">
            <caption className="sr-only">{t("roster.title")}</caption>
            <thead>
              <tr className="text-muted">
                <th scope="col" className="px-2 py-1 text-start font-medium">{t("roster.employee")}</th>
                {dates.map((d) => (
                  <th key={toISODate(d)} scope="col" className="px-1 py-1 text-center font-medium">
                    <span className="block">{format.date(d, "weekday")}</span>
                    <span className="num block text-xs">{format.date(d, "dayMonth")}</span>
                  </th>
                ))}
                <th scope="col" className="px-2 py-1 text-center font-medium">{t("roster.weekHours")}</th>
              </tr>
            </thead>
            <tbody>
              {(data.data?.rows ?? []).map((r) => {
                const week = r.weeks[0];
                return (
                  <tr key={r.employee.id} className="bg-white">
                    <th scope="row" className="rounded-s-card px-3 py-2 text-start font-medium">
                      <span className="block text-ink">{format.name(r.employee)}</span>
                      <span className="num block text-xs text-muted">
                        {r.employee.employee_no}
                        {r.employee.department && ` · ${r.employee.department}`}
                      </span>
                    </th>
                    {r.days.map((d) => (
                      <td key={d.date} className="px-1 py-1.5 text-center">
                        <DayCell day={d} shift={d.shift ? byId.get(d.shift) : undefined} label={label(d)} onClick={manage ? () => setCell({ employee: r.employee, day: d }) : undefined} />
                      </td>
                    ))}
                    <td className="rounded-e-card px-2 py-2 text-center">
                      {week && (
                        <span className="flex flex-col items-center gap-0.5">
                          <span className={`num font-semibold ${week.over ? "text-danger" : "text-ink"}`}>{hm(week.minutes)}</span>
                          {week.over && <Pill tone="salmon">{t("roster.over", { hours: week.limit_minutes / 60 })}</Pill>}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data.isSuccess && data.data.rows.length === 0 && <p className="py-6 text-center text-muted">{t("roster.noPeople")}</p>}
        </div>
        <p className="mt-3 text-sm text-muted">{t("roster.legend")}</p>
      </Card>
      {manage && <AssignmentsCard />}
      {cell && <ChangeDialog cell={cell} onClose={() => setCell(null)} />}
      {assigning && <AssignDialog onClose={() => setAssigning(false)} />}
    </div>
  );
}

function DayCell({ day, shift, label, onClick }: { day: RosterDay; shift?: ShiftBrief; label: string; onClick?: () => void }) {
  const format = useFormat();
  const { t } = useTranslation();
  const body = shift ? (
    <span className={`flex min-h-12 flex-col items-center justify-center rounded-lg px-1 py-1 text-white ${DOTS[shift.color]}`}>
      <span className="text-xs font-semibold leading-tight">{shift.code || format.name(shift)}</span>
      <span className="num text-[11px] opacity-90">{hm(day.minutes)}</span>
    </span>
  ) : (
    <span className={`flex min-h-12 items-center justify-center rounded-lg px-1 text-xs ${day.off ? "bg-neutral-soft text-muted" : "border border-dashed border-line text-subtle"}`}>
      {day.off ? t("roster.offShort") : "—"}
    </span>
  );
  return (
    <span className="relative block">
      {onClick ? (
        <button type="button" aria-label={label} title={label} className="block w-full cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-teal-dark" onClick={onClick}>
          {body}
        </button>
      ) : (
        <span role="img" aria-label={label} title={label}>
          {body}
        </span>
      )}
      {day.ramadan && <Moon aria-hidden="true" className={`absolute -top-1 start-0 size-3.5 ${day.needs_ramadan_times ? "text-danger" : "text-amber-600"}`} />}
      {day.source === "override" && <span aria-hidden="true" className="absolute -top-1 end-0 size-2.5 rounded-full bg-orange-500 ring-2 ring-white" />}
    </span>
  );
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => Promise.all(["roster", "assignments"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
}

function ChangeDialog({ cell, onClose }: { cell: Cell; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const invalidate = useInvalidate();
  const shiftList = useQuery({ queryKey: ["shifts", "active", ...scope], queryFn: () => shifts.list(true) });
  const [choice, setChoice] = useState(cell.day.shift ? String(cell.day.shift) : cell.day.off ? "off" : "");
  const [reason, setReason] = useState("");
  const existing = useQuery({ queryKey: ["roster", "change", cell.employee.id, cell.day.date], queryFn: () => roster.overrides(cell.employee.id, cell.day.date, cell.day.date), enabled: cell.day.source === "override" });
  const save = useMutation({
    mutationFn: () => roster.change({ employee: cell.employee.id, date: cell.day.date, shift: choice === "off" ? null : Number(choice), reason }),
    onSuccess: async () => {
      await invalidate();
      onClose();
    },
  });
  const undo = useMutation({
    mutationFn: () => roster.removeChange(existing.data!.results[0].id),
    onSuccess: async () => {
      await invalidate();
      onClose();
    },
  });
  const errors = apiErrors(save.error ?? undo.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("roster.changeTitle", { name: format.name(cell.employee), day: format.date(cell.day.date, "dayMonthYear") })}
      footer={
        <>
          {cell.day.source === "override" && existing.data?.results[0] && (
            <Button variant="outline" className="me-auto" disabled={undo.isPending} onClick={() => undo.mutate()}>
              {t("roster.undoChange")}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!choice || save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t("roster.changeHint")}</p>
        <FormSelect label={t("roster.thatDay")} name="choice" value={choice} placeholder={t("common.choose")} onChange={(e) => setChoice(e.target.value)} options={[{ value: "off", label: t("roster.dayOff") }, ...(shiftList.data ?? []).map((s) => ({ value: String(s.id), label: format.name(s) }))]} />
        <TextField label={t("roster.reason")} name="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        {(errors.general || errors.fields.detail) && <Alert>{errors.general ?? errors.fields.detail}</Alert>}
      </div>
    </Dialog>
  );
}

const TARGETS: AssignmentTarget[] = ["employee", "group", "department", "branch", "company"];

function AssignDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const invalidate = useInvalidate();
  const [v, setV] = useState({ target: "department" as AssignmentTarget, who: "", what: "", start_date: toISODate(new Date()), end_date: "", note: "" });
  const [search, setSearch] = useState("");
  const set = <K extends keyof typeof v>(key: K, value: (typeof v)[K]) => setV((x) => ({ ...x, [key]: value }));
  const people = useQuery({ queryKey: ["roster", "people", search, ...scope], queryFn: () => hr.searchEmployees(search), enabled: v.target === "employee", placeholderData: (previous) => previous });
  const groups = useQuery({ queryKey: ["employee-groups", ...scope], queryFn: attendance.groups, enabled: v.target === "group" });
  const departments = useQuery({ queryKey: ["master", "departments", ...scope], queryFn: endpoints.departments, enabled: v.target === "department" });
  const branches = useQuery({ queryKey: ["master", "branches", ...scope], queryFn: hr.branches, enabled: v.target === "branch" });
  const shiftList = useQuery({ queryKey: ["shifts", "active", ...scope], queryFn: () => shifts.list(true) });
  const rotations = useQuery({ queryKey: ["rotations", ...scope], queryFn: roster.rotations });
  const whoOptions =
    v.target === "employee"
      ? (people.data?.results ?? []).map((e) => ({ value: String(e.id), label: `${format.name(e)} · ${e.employee_no}` }))
      : v.target === "group"
        ? (groups.data ?? []).map((g) => ({ value: String(g.id), label: format.name(g) }))
        : v.target === "department"
          ? (departments.data?.results ?? []).map((d) => ({ value: String(d.id), label: format.name(d) }))
          : (branches.data?.results ?? []).map((b) => ({ value: String(b.id), label: format.name(b) }));
  const whatOptions = [
    ...(shiftList.data ?? []).map((s) => ({ value: `s${s.id}`, label: format.name(s) })),
    ...(rotations.data ?? []).filter((r) => r.is_active).map((r) => ({ value: `r${r.id}`, label: t("roster.rotationOption", { name: format.name(r) }) })),
  ];
  const save = useMutation({
    mutationFn: () =>
      roster.assign({
        target: v.target,
        ...(v.target !== "company" ? { [v.target]: Number(v.who) } : {}),
        shift: v.what.startsWith("s") ? Number(v.what.slice(1)) : null,
        rotation: v.what.startsWith("r") ? Number(v.what.slice(1)) : null,
        start_date: v.start_date,
        end_date: v.end_date || null,
        note: v.note,
      }),
    onSuccess: async () => {
      await invalidate();
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={t("roster.assign")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!v.what || !v.start_date || (v.target !== "company" && !v.who) || save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormSelect label={t("roster.for")} name="target" value={v.target} onChange={(e) => setV({ ...v, target: e.target.value as AssignmentTarget, who: "" })} options={TARGETS.map((x) => ({ value: x, label: t(`roster.targets.${x}`) }))} />
        {v.target === "employee" && <TextField label={t("workflow.preview.findEmployee")} type="search" value={search} onChange={(e) => setSearch(e.target.value)} />}
        {v.target !== "company" && (
          <FormSelect className={v.target === "employee" ? "sm:col-span-2" : ""} label={t(`roster.targets.${v.target}`)} name="who" value={v.who} placeholder={t("common.choose")} options={whoOptions} onChange={(e) => set("who", e.target.value)} error={errors.fields[v.target]} />
        )}
        <FormSelect className="sm:col-span-2" label={t("roster.what")} name="what" value={v.what} placeholder={t("common.choose")} options={whatOptions} onChange={(e) => set("what", e.target.value)} error={errors.fields.shift} />
        <DateInput label={t("roster.from")} name="start_date" value={v.start_date} onChange={(d) => set("start_date", d ?? "")} error={errors.fields.start_date} required />
        <DateInput label={t("roster.to")} name="end_date" value={v.end_date || null} min={v.start_date} onChange={(d) => set("end_date", d ?? "")} hint={t("roster.openEnded")} error={errors.fields.end_date} />
        <TextField className="sm:col-span-2" label={t("roster.note")} name="note" value={v.note} onChange={(e) => set("note", e.target.value)} />
        <p className="text-sm text-muted sm:col-span-2">{t("roster.precedence")}</p>
        {errors.general && <Alert className="sm:col-span-2">{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

function AssignmentsCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const invalidate = useInvalidate();
  const [page, setPage] = useState(1);
  const list = useQuery({ queryKey: ["assignments", page, ...scope], queryFn: () => roster.assignments({ page }), placeholderData: keepPreviousData });
  const end = useMutation({ mutationFn: (a: Assignment) => roster.assign({ end_date: toISODate(addDays(new Date(), -1)) }, a.id), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (a: Assignment) => roster.unassign(a.id), onSuccess: invalidate });
  const today = toISODate(new Date());
  const total = list.data?.count ?? 0;
  return (
    <Card variant="solid" title={t("roster.assignments")} subtitle={t("roster.assignmentsHint")}>
      {list.isSuccess && total === 0 ? (
        <p className="text-sm text-muted">{t("roster.noAssignments")}</p>
      ) : (
        <ul aria-label={t("roster.assignments")} className="flex flex-col divide-y divide-line">
          {(list.data?.results ?? []).map((a) => {
            const name = format.pick(a.target_name);
            const ended = a.end_date !== null && a.end_date < today;
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                <Pill tone="lavender">{t(`roster.targets.${a.target}`)}</Pill>
                <span className="min-w-40 font-medium text-ink">{a.target === "company" ? t("roster.targets.company") : name}</span>
                <span className="text-sm">{a.what.kind === "rotation" ? t("roster.rotationOption", { name: format.name(a.what) }) : format.name(a.what)}</span>
                <span className="num text-sm text-muted">{a.end_date ? format.dateRange(a.start_date, a.end_date) : t("roster.since", { day: format.date(a.start_date, "dayMonthYear") })}</span>
                {ended && <Pill tone="neutral">{t("roster.ended")}</Pill>}
                <span className="ms-auto flex gap-1">
                  {!ended && a.start_date < today && (
                    <Button size="sm" variant="outline" disabled={end.isPending} onClick={() => end.mutate(a)}>
                      {t("roster.endNow")}
                    </Button>
                  )}
                  <IconButton size="sm" variant="plain" label={t("roster.removeAssignment", { name })} icon={<Trash2 />} disabled={remove.isPending} onClick={() => remove.mutate(a)} />
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {total > 25 && <Pagination page={page} pageCount={Math.ceil(total / 25)} onPageChange={setPage} />}
    </Card>
  );
}
