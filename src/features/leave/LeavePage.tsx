import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Undo2 } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";

import { endpoints } from "@/api";
import { dashboard } from "@/api/dashboard";
import { hr } from "@/api/hr";
import { leave, type LeaveInput, type LeavePreview, type LeaveRequest } from "@/api/leave";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable, PersonCell } from "@/design/DataTable";
import { DateInput } from "@/design/DateInput";
import { Dialog } from "@/design/Dialog";
import { CheckField, FormSelect, TextArea, TextField } from "@/design/Field";
import { FileDrop } from "@/design/FileDrop";
import { Pagination } from "@/design/Pagination";
import { Pill, StatusChip } from "@/design/Pill";
import { Tabs } from "@/design/Tabs";
import { Page } from "@/layout/Page";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

import { BalanceReport } from "./BalanceReport";

type Tab = "mine" | "all" | "balances";

/** /leave — my balances and leave requests, asking for leave with a live count of the days (#50); HR sees every
 * request in its scope and reverses approved leave (decision 12); managers and HR get the balance report (#132). */
export default function LeavePage() {
  const { t } = useTranslation();
  const { can, me } = useSession();
  const [params, setParams] = useSearchParams();
  const manages = can("leave.manage_balances");
  const scope = useScopeKey();
  // The balance report (#132) is for those who see more than their own balance (managers, HR).
  const meta = useQuery({ queryKey: ["leave", "report", "meta", ...scope], queryFn: dashboard.leaveReportMeta, enabled: can("leave.view_balances") });
  const reports = Boolean(meta.data?.others);
  const tabs: Tab[] = ["mine", ...(manages ? (["all"] as const) : []), ...(reports ? (["balances"] as const) : [])];
  const asked = params.get("tab") as Tab | null;
  const tab: Tab = asked && tabs.includes(asked) ? asked : "mine";
  const [asking, setAsking] = useState<{ editing?: LeaveRequest } | null>(null);
  return (
    <Page
      title={t("leave.title")}
      tabs={
        tabs.length > 1 && (
          <Tabs
            label={t("leave.title")}
            value={tab}
            onChange={(next) => setParams(next === "mine" ? {} : { tab: next }, { replace: true })}
            items={tabs.map((id) => ({ id, label: t(`leave.tabs.${id}`) }))}
          />
        )
      }
      actions={
        me?.employee && can("selfservice.submit") && (
          <Button variant="accent" icon={<CalendarPlus className="size-[18px]" />} onClick={() => setAsking({})}>
            {t("leave.ask")}
          </Button>
        )
      }
    >
      {tab === "mine" ? <MyLeave onEdit={(editing) => setAsking({ editing })} /> : tab === "all" ? <AllLeave /> : <BalanceReport />}
      {asking && <AskDialog editing={asking.editing} onClose={() => setAsking(null)} />}
    </Page>
  );
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(["leave", "employee", "approvals", "requests"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
}

function MyLeave({ onEdit }: { onEdit: (r: LeaveRequest) => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const { me } = useSession();
  const invalidate = useInvalidate();
  const balances = useQuery({ queryKey: ["leave", "my-balances", ...scope], queryFn: () => leave.balances(), enabled: Boolean(me?.employee) });
  const [page, setPage] = useState(1);
  const requests = useQuery({ queryKey: ["leave", "requests", "mine", page, ...scope], queryFn: () => leave.requests({ mine: true, page }) });
  const cancel = useMutation({ mutationFn: (r: LeaveRequest) => endpoints.cancelRequest(r.workflow_id!), onSuccess: invalidate });
  const [confirming, setConfirming] = useState<LeaveRequest | null>(null);
  const withBalance = (balances.data?.balances ?? []).filter((b) => b.kind === "yearly" || b.kind === "window" || b.kind === "service");

  return (
    <div className="flex flex-col gap-4">
      {withBalance.length > 0 && (
        <ul aria-label={t("leaveTab.balances")} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {withBalance.map((b) => (
            <li key={b.leave_type.id} className="rounded-panel bg-white p-5 shadow-soft">
              <Pill tone={b.leave_type.color}>{format.name(b.leave_type)}</Pill>
              <p className="mt-3 flex items-baseline gap-1.5">
                <span className="num text-3xl font-semibold text-ink">{format.number(Number(b.available), [0, 2])}</span>
                <span className="text-sm text-muted">{t("leave.daysLeft")}</span>
              </p>
              {Number(b.pending) > 0 && <p className="num mt-1 text-sm text-amber-700">{t("leave.pendingDays", { days: format.number(Number(b.pending), [0, 2]) })}</p>}
            </li>
          ))}
        </ul>
      )}
      <Card variant="solid" title={t("leave.myRequests")}>
        <RequestTable
          rows={requests.data?.results ?? []}
          loading={requests.isPending}
          actions={(r) => (
            <span className="flex justify-end gap-2">
              {r.return_state === "due" && (
                <Button size="sm" variant="accent" onClick={() => setConfirming(r)}>
                  {t("leave.return.confirm")}
                </Button>
              )}
              {r.status === "returned" && (
                <Button size="sm" variant="outline" onClick={() => onEdit(r)}>
                  {t("approvals.editAndResubmit")}
                </Button>
              )}
              {(r.status === "pending" || r.status === "returned") && r.workflow_id && (
                <Button size="sm" variant="ghost" disabled={cancel.isPending} onClick={() => cancel.mutate(r)}>
                  {t("approvals.cancelRequest")}
                </Button>
              )}
            </span>
          )}
        />
        <Pages count={requests.data?.count ?? 0} page={page} onPageChange={setPage} />
        {cancel.error && <Alert className="mt-3">{apiErrors(cancel.error, t("common.saveFailed")).general}</Alert>}
        {confirming && <ReturnDialog request={confirming} onClose={() => setConfirming(null)} />}
      </Card>
    </div>
  );
}

function AllLeave() {
  const { t } = useTranslation();
  const scope = useScopeKey();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [reversing, setReversing] = useState<LeaveRequest | null>(null);
  const [confirming, setConfirming] = useState<LeaveRequest | null>(null);
  const requests = useQuery({
    queryKey: ["leave", "requests", "all", status, page, ...scope],
    queryFn: () => (status === "return_due" ? leave.requests({ return: "due", page }) : leave.requests({ status: status || undefined, page })),
  });
  return (
    <Card
      variant="solid"
      title={t("leave.tabs.all")}
      action={
        <FormSelect
          label={t("approvals.columns.status")}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          placeholder={t("leave.allStatuses")}
          options={[
            ...(["pending", "approved", "returned", "rejected", "cancelled"] as const).map((s) => ({ value: s, label: t(`requestStatus.${s}`) })),
            { value: "return_due", label: t("leave.return.due") },
          ]}
          className="min-w-44"
        />
      }
    >
      <RequestTable
        rows={requests.data?.results ?? []}
        loading={requests.isPending}
        withEmployee
        actions={(r) => (
          <span className="flex justify-end gap-2">
            {r.return_state === "due" && (
              <Button size="sm" variant="accent" onClick={() => setConfirming(r)}>
                {t("leave.return.confirm")}
              </Button>
            )}
            {r.status === "approved" && !r.reversed_at && !r.returned_on && (
              <Button size="sm" variant="outline" icon={<Undo2 className="size-4" />} onClick={() => setReversing(r)}>
                {t("leave.reverse.button")}
              </Button>
            )}
          </span>
        )}
      />
      <Pages count={requests.data?.count ?? 0} page={page} onPageChange={setPage} />
      {confirming && <ReturnDialog request={confirming} onClose={() => setConfirming(null)} />}
      {reversing && <ReverseDialog request={reversing} onClose={() => setReversing(null)} />}
    </Card>
  );
}

const PAGE_SIZE = 25; // the API's page size

/** The list's pages (the API returns 25 at a time; without these, older requests couldn't be reached). */
function Pages({ count, page, onPageChange }: { count: number; page: number; onPageChange: (page: number) => void }) {
  if (count <= PAGE_SIZE) return null;
  return <Pagination page={page} pageCount={Math.ceil(count / PAGE_SIZE)} onPageChange={onPageChange} />;
}

function RequestTable({ rows, loading, withEmployee = false, actions }: { rows: LeaveRequest[]; loading: boolean; withEmployee?: boolean; actions: (r: LeaveRequest) => ReactNode }) {
  const { t } = useTranslation();
  const format = useFormat();
  const columns: Column<LeaveRequest>[] = [
    ...(withEmployee ? [{ id: "employee", header: t("leave.columns.employee"), cell: (r: LeaveRequest) => <PersonCell name={format.name(r.employee)} /> }] : []),
    { id: "type", header: t("leave.columns.type"), cell: (r) => <Pill tone={r.leave_type.color}>{format.name(r.leave_type)}</Pill> },
    {
      id: "dates",
      header: t("leave.columns.dates"),
      cell: (r) => (
        <span className="num flex flex-col">
          <span>{format.dateRange(r.start_date, r.end_date)}</span>
          {r.reversed_from && <span className="text-xs text-danger">{t("leave.reversedFrom", { day: format.date(r.reversed_from) })}</span>}
        </span>
      ),
    },
    { id: "days", header: t("leave.columns.days"), cell: (r) => <span className="num">{format.number(Number(r.days), [0, 2])}</span> },
    {
      id: "status",
      header: t("leave.columns.status"),
      cell: (r) => (
        <span className="flex flex-wrap items-center gap-2">
          <StatusChip status={r.status} label={t(`requestStatus.${r.status}`)} />
          {r.approval?.step && <span className="text-sm text-muted">{format.pick(r.approval.step)}</span>}
          {r.approval?.comment && <span className="text-sm text-muted">“{r.approval.comment}”</span>}
          {r.return_state && (
            <Pill tone={r.return_state === "due" ? "amber" : r.return_state === "late" ? "salmon" : "green"}>
              {r.return_state === "late"
                ? t("leave.return.late", { days: format.number(Number(r.late_days), [0, 2]) })
                : t(`leave.return.states.${r.return_state}`, { day: r.expected_return ? format.date(r.expected_return) : "" })}
            </Pill>
          )}
          {r.substitute && <span className="text-sm text-muted">{t("leave.substituteIs", { name: format.name(r.substitute) })}</span>}
          {r.workflow_id && (
            <Link to={`/approvals?tab=mine&request=${r.workflow_id}`} className="text-sm text-teal-dark hover:underline">
              {t("pendingApprovals.open")}
            </Link>
          )}
        </span>
      ),
    },
    { id: "actions", header: <span className="sr-only">{t("common.actions")}</span>, cell: actions },
  ];
  return <DataTable caption={t("leave.myRequests")} columns={columns} rows={rows} rowKey={(r) => String(r.id)} loading={loading} empty={t("leave.none")} minWidth={760} />;
}

// --- asking ---------------------------------------------------------------------------------------

export function AskDialog({ editing, onClose }: { editing?: LeaveRequest; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const invalidate = useInvalidate();
  const types = useQuery({ queryKey: ["leave", "requestable", ...scope], queryFn: () => leave.requestableTypes() });
  const [values, setValues] = useState({
    leave_type: editing ? String(editing.leave_type.id) : "",
    start_date: editing?.start_date ?? "",
    end_date: editing?.end_date ?? "",
    event_date: editing?.event_date ?? "",
    reason: editing?.reason ?? "",
    substitute: editing?.substitute ? String(editing.substitute.id) : "",
    handover_notes: editing?.handover_notes ?? "",
    pay_in_advance: editing?.pay_in_advance ?? false,
  });
  // A non-Saudi travelling abroad asks for an exit re-entry visa from here (Phase 5 task 10): the form opens next,
  // filled from the leave.
  const { me, hasModule } = useSession();
  const [, setParams] = useSearchParams();
  const own = useQuery({ queryKey: ["my-file", me?.employee?.id], queryFn: () => hr.employee(me!.employee!.id), enabled: Boolean(me?.employee && hasModule("compliance") && !editing) });
  const mayTravel = Boolean(own.data?.nationality && own.data.nationality !== "SA");
  const [travelling, setTravelling] = useState(false);
  const [mateSearch, setMateSearch] = useState("");
  const mates = useQuery({
    queryKey: ["leave", "substitutes", mateSearch, ...scope],
    queryFn: () => leave.substitutes(mateSearch),
    placeholderData: (previous) => previous,
  });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<LeavePreview | null>(null);
  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => setValues((v) => ({ ...v, [key]: value }));
  const type = types.data?.find((x) => String(x.id) === values.leave_type);
  const body = (): LeaveInput => ({
    leave_type: Number(values.leave_type),
    start_date: values.start_date,
    end_date: values.end_date,
    reason: values.reason,
    handover_notes: values.handover_notes,
    pay_in_advance: Boolean(type?.pay_in_advance && values.pay_in_advance),
    ...(values.event_date ? { event_date: values.event_date } : {}),
    ...(values.substitute ? { substitute: Number(values.substitute) } : {}),
  });
  const ready = Boolean(values.leave_type && values.start_date && values.end_date);

  // Count the days and the balance as the dates change (nothing is saved).
  useEffect(() => {
    if (!ready) return setPreview(null);
    let live = true;
    const timer = window.setTimeout(() => {
      leave.preview(body(), editing?.id).then((p) => live && setPreview(p)).catch(() => live && setPreview(null));
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.leave_type, values.start_date, values.end_date, values.event_date, values.substitute, ready]);

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        await leave.updateLeave(editing.id, { ...body(), ...(file ? { file } : {}) });
        return leave.resubmitLeave(editing.id);
      }
      return leave.askLeave({ ...body(), ...(file ? { file } : {}) });
    },
    onSuccess: async (made) => {
      await invalidate();
      onClose();
      if (travelling && made && "id" in made) setParams((p) => ({ ...Object.fromEntries(p), new: "exit_reentry", leave: String(made.id) }));
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const first = (field: string) => errors.fields[field] ?? preview?.errors[field]?.[0];

  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={editing ? t("approvals.editAndResubmit") : t("leave.ask")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="accent" disabled={!ready || save.isPending} onClick={() => save.mutate()}>
            {t("approvals.send")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormSelect
          label={t("leave.columns.type")}
          name="leave_type"
          value={values.leave_type}
          placeholder={t("common.choose")}
          options={(types.data ?? []).map((x) => ({ value: String(x.id), label: format.name(x) }))}
          onChange={(e) => set("leave_type", e.target.value)}
          error={first("leave_type")}
          required
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <DateInput label={t("leave.from")} name="start_date" value={values.start_date || null} onChange={(d) => set("start_date", d ?? "")} error={first("start_date")} required />
          <DateInput label={t("leave.to")} name="end_date" value={values.end_date || null} min={values.start_date || undefined} onChange={(d) => set("end_date", d ?? "")} error={first("end_date")} required />
          {type?.needs_event && (
            <DateInput label={t("leave.eventDate")} name="event_date" value={values.event_date || null} onChange={(d) => set("event_date", d ?? "")} error={first("event_date")} required />
          )}
        </div>
        {preview && (
          <div role="status" className="num flex flex-wrap items-center gap-x-6 gap-y-1 rounded-card bg-teal-soft px-4 py-3 text-sm text-teal-ink">
            <span>
              <strong className="text-base">{format.number(Number(preview.days), [0, 2])}</strong>{" "}
              {t(preview.count_mode === "working" ? "leaveTab.workingDays" : "leaveTab.days")}
            </span>
            {preview.balance && (
              <span>
                {t("leave.balanceAfter", { before: format.number(Number(preview.balance.available), [0, 2]), after: format.number(Number(preview.balance.after), [0, 2]) })}
                {Number(preview.balance.pending) > 0 && ` · ${t("leave.pendingDays", { days: format.number(Number(preview.balance.pending), [0, 2]) })}`}
              </span>
            )}
          </div>
        )}
        {(first("days") || first("detail")) && <Alert>{first("days") ?? first("detail")}</Alert>}
        {(type?.requires_attachment || editing?.has_file) && (
          <FileDrop label={t("leave.attachment")} file={file} onChange={setFile} error={errors.fields.file} />
        )}
        {type?.pay_in_advance && (
          <div className="flex flex-col gap-1">
            <CheckField label={t("leave.payInAdvance")} checked={values.pay_in_advance} onChange={(e) => set("pay_in_advance", e.target.checked)} />
            <p className={first("pay_in_advance") ? "text-sm text-danger" : "text-sm text-muted"}>{first("pay_in_advance") ?? t("leave.payInAdvanceHint")}</p>
          </div>
        )}
        <TextArea label={t("leave.reason")} name="reason" rows={2} value={values.reason} onChange={(e) => set("reason", e.target.value)} />
        {mayTravel && <CheckField label={t("leave.travelling")} checked={travelling} onChange={(e) => setTravelling(e.target.checked)} />}
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-medium text-ink">{t("leave.handover")}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label={t("leave.findColleague")} type="search" value={mateSearch} onChange={(e) => setMateSearch(e.target.value)} />
            <FormSelect
              label={t("leave.substitute")}
              name="substitute"
              value={values.substitute}
              placeholder={t("leave.noSubstitute")}
              options={[
                ...(editing?.substitute && !(mates.data ?? []).some((m) => m.id === editing.substitute!.id)
                  ? [{ value: String(editing.substitute.id), label: format.name(editing.substitute) }]
                  : []),
                ...(mates.data ?? []).map((m) => ({ value: String(m.id), label: `${format.name(m)} · ${m.employee_no}` })),
              ]}
              onChange={(e) => set("substitute", e.target.value)}
              error={first("substitute")}
            />
          </div>
          {values.substitute && (
            <TextArea label={t("leave.handoverNotes")} name="handover_notes" rows={2} value={values.handover_notes} onChange={(e) => set("handover_notes", e.target.value)} />
          )}
        </fieldset>
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

function ReverseDialog({ request, onClose }: { request: LeaveRequest; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const invalidate = useInvalidate();
  const [from, setFrom] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const save = useMutation({
    mutationFn: () => leave.reverseLeave(request.id, { reason, ...(from ? { from_date: from } : {}) }),
    onSuccess: async () => {
      await invalidate();
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("leave.reverse.title")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={save.isPending || !reason.trim()} onClick={() => save.mutate()}>
            {t("leave.reverse.confirm")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          {format.name(request.employee)} · {format.name(request.leave_type)} · {format.dateRange(request.start_date, request.end_date)}
        </p>
        <DateInput label={t("leave.reverse.from")} name="from_date" value={from} min={request.start_date} max={request.end_date} onChange={setFrom} hint={t("leave.reverse.fromHint")} error={errors.fields.from_date} />
        <TextField label={t("leave.reason")} name="reason" value={reason} onChange={(e) => setReason(e.target.value)} error={errors.fields.reason} required />
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

function ReturnDialog({ request, onClose }: { request: LeaveRequest; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const invalidate = useInvalidate();
  const [day, setDay] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => leave.confirmReturn(request.id, day ?? undefined),
    onSuccess: async () => {
      await invalidate();
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("leave.return.title")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="accent" disabled={save.isPending} onClick={() => save.mutate()}>
            {t("leave.return.confirm")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          {format.name(request.leave_type)} · {format.dateRange(request.start_date, request.end_date)}
          {request.expected_return && ` · ${t("leave.return.expected", { day: format.date(request.expected_return) })}`}
        </p>
        <DateInput label={t("leave.return.day")} name="returned_on" value={day} onChange={setDay} hint={t("leave.return.dayHint")} error={errors.fields.returned_on} />
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
