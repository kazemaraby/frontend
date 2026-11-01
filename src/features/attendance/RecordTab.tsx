import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { endpoints } from "@/api";
import { type AttendanceDay, days, periods } from "@/api/attendance";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { DateInput } from "@/design/DateInput";
import { FormSelect, SearchInput } from "@/design/Field";
import { KpiTile } from "@/design/KpiTile";
import { Pagination } from "@/design/Pagination";
import { Pill } from "@/design/Pill";
import { toISODate } from "@/lib/format";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

import { hm, useClock } from "./clock";
import { DAY_TONES } from "./tones";

const FILTERS = {
  attended: "present,late,early_leave",
  late: "late",
  absent: "absent,incomplete",
  away: "leave,mission,trip,remote",
} as const;

/** The attendance record (Phase 3 task 5): everyone's day as it was built from the roster, the punches, the approved
 * requests and the calendar — status, first in / last out, worked time, late and early-leave minutes. */
export function RecordTab() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const { can } = useSession();
  const clock = useClock();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(() =>
    toISODate(new Date(Date.now() - 86_400_000)),
  );
  const [filters, setFilters] = useState<{
    status?: string;
    department?: number;
    search?: string;
  }>({});
  const [page, setPage] = useState(1);
  const list = useQuery({
    queryKey: ["attendance-days", date, filters, page, ...scope],
    queryFn: () => days.list({ date, ...filters, page }),
    placeholderData: keepPreviousData,
  });
  const all = useQuery({
    queryKey: ["attendance-days", "summary", date, ...scope],
    queryFn: () => days.list({ date, page_size: 1000 }),
  });
  const departments = useQuery({
    queryKey: ["master", "departments", ...scope],
    queryFn: endpoints.departments,
  });
  const months = useQuery({ queryKey: ["attendance-periods", Number(date.slice(0, 4)), ...scope], queryFn: () => periods.list(Number(date.slice(0, 4))), enabled: Boolean(date) });
  const locked = months.data?.months.find((m) => m.month === date.slice(0, 7))?.status === "locked";
  const rebuild = useMutation({
    mutationFn: () => days.rebuild({ from: date }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["attendance-days"] }),
  });
  const count = (statuses: string) =>
    (all.data?.results ?? []).filter((d) =>
      statuses.split(",").includes(d.status),
    ).length;
  const minutes = (m: number) => (m ? hm(m) : "—");

  const columns: Column<AttendanceDay>[] = [
    {
      id: "employee",
      header: t("record.employee"),
      cell: (d) => (
        <span className="flex flex-col">
          <span className="font-semibold text-ink">
            {format.name(d.employee)}
          </span>
          <span className="num text-xs text-muted">
            {d.employee.employee_no}
          </span>
        </span>
      ),
    },
    {
      id: "shift",
      header: t("record.shift"),
      cell: (d) =>
        d.shift ? (
          <span>
            {format.name(d.shift)}
            {d.ramadan && (
              <span className="text-xs text-muted">
                {" "}
                · {t("record.ramadan")}
              </span>
            )}
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      id: "times",
      header: t("record.inOut"),
      cell: (d) => (
        <span className="num" dir="ltr">
          {clock(d.first_in, d.time_zone)} – {clock(d.last_out, d.time_zone)}
        </span>
      ),
    },
    {
      id: "worked",
      header: t("record.worked"),
      cell: (d) => (
        <span className="num">
          {minutes(d.worked_minutes)}
          {d.scheduled_minutes > 0 && (
            <span className="text-xs text-muted">
              {" "}
              / {hm(d.scheduled_minutes)}
            </span>
          )}
        </span>
      ),
    },
    {
      id: "late",
      header: t("record.late"),
      cell: (d) => (
        <span
          className={`num ${d.late_minutes ? "text-amber-800" : "text-muted"}`}
        >
          {minutes(d.late_minutes)}
        </span>
      ),
    },
    {
      id: "early",
      header: t("record.early"),
      cell: (d) => (
        <span
          className={`num ${d.early_leave_minutes ? "text-orange-800" : "text-muted"}`}
        >
          {minutes(d.early_leave_minutes)}
        </span>
      ),
    },
    {
      id: "overtime",
      header: t("record.overtime"),
      cell: (d) =>
        d.overtime_minutes ? (
          <span className="flex flex-col items-start gap-0.5">
            <span className="num font-medium">{hm(d.overtime_minutes)}</span>
            <span className="text-xs text-muted">
              {t(`record.overtimeKinds.${d.overtime_kind}`)}
            </span>
            {d.overtime_approved_minutes ? (
              <Pill tone="green">
                {t("record.approvedOvertime", {
                  hours: hm(d.overtime_approved_minutes),
                })}
              </Pill>
            ) : (
              <Pill tone="neutral">{t("record.notApproved")}</Pill>
            )}
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      id: "status",
      header: t("approvals.columns.status"),
      cell: (d) => (
        <span className="flex flex-col items-start gap-1">
          <Pill tone={DAY_TONES[d.status]}>
            {d.covers[0] &&
            ["leave", "mission", "trip", "remote"].includes(d.status)
              ? format.pick(d.covers[0].label)
              : t(`record.status.${d.status}`)}
          </Pill>
          {d.is_late && d.is_early_leave && (
            <span className="text-xs text-muted">
              {t("record.status.early_leave")}
            </span>
          )}
        </span>
      ),
    },
    {
      id: "notes",
      header: t("record.notes"),
      cell: (d) => (
        <span className="flex flex-wrap gap-1">
          {d.half_day && <Pill tone="pink">{t("record.halfDay")}</Pill>}
          {d.covered_minutes > 0 && (
            <Pill tone="sky">
              {t("record.covered", { minutes: d.covered_minutes })}
            </Pill>
          )}
          {d.flags.map((f) => (
            <Pill key={f} tone="neutral">
              {t(`record.flags.${f}`)}
            </Pill>
          ))}
        </span>
      ),
    },
  ];
  const total = list.data?.count ?? 0;
  return (
    <div className="flex flex-col gap-4">
      <ul
        aria-label={t("record.summary")}
        className="grid grid-cols-2 gap-4 xl:grid-cols-4"
      >
        <li>
          <KpiTile
            label={t("record.kpi.attended")}
            value={format.number(count(FILTERS.attended))}
            tone="green"
          />
        </li>
        <li>
          <KpiTile
            label={t("record.kpi.late")}
            value={format.number(count(FILTERS.late))}
            tone="amber"
          />
        </li>
        <li>
          <KpiTile
            label={t("record.kpi.absent")}
            value={format.number(count(FILTERS.absent))}
            tone="red"
          />
        </li>
        <li>
          <KpiTile
            label={t("record.kpi.away")}
            value={format.number(count(FILTERS.away))}
            tone="violet"
          />
        </li>
      </ul>
      <Card
        variant="solid"
        title={t("record.title")}
        subtitle={t("record.hint")}
        action={
          can("attendance.manage") && (
            <Button
              size="sm"
              variant="outline"
              icon={<RefreshCw className="size-4" />}
              disabled={rebuild.isPending || locked}
              onClick={() => rebuild.mutate()}
            >
              {t("record.rebuild")}
            </Button>
          )
        }
      >
        {locked && (
          <Alert tone="info" className="mb-4">
            {t("record.monthLocked")}
          </Alert>
        )}
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <DateInput
            label={t("record.date")}
            name="date"
            value={date}
            max={toISODate(new Date())}
            onChange={(d) => {
              if (d) {
                setDate(d);
                setPage(1);
              }
            }}
          />
          <FormSelect
            label={t("approvals.columns.status")}
            name="status"
            value={filters.status ?? ""}
            placeholder={t("record.everyStatus")}
            options={Object.entries(FILTERS).map(([key, value]) => ({
              value,
              label: t(`record.kpi.${key}`),
            }))}
            onChange={(e) => {
              setFilters({ ...filters, status: e.target.value || undefined });
              setPage(1);
            }}
          />
          <FormSelect
            label={t("leaveReport.department")}
            name="department"
            value={String(filters.department ?? "")}
            placeholder={t("leaveReport.everyDepartment")}
            options={(departments.data?.results ?? []).map((d) => ({
              value: String(d.id),
              label: format.name(d),
            }))}
            onChange={(e) => {
              setFilters({
                ...filters,
                department: e.target.value ? Number(e.target.value) : undefined,
              });
              setPage(1);
            }}
          />
          <SearchInput
            label={t("roster.search")}
            className="self-end"
            value={filters.search ?? ""}
            onChange={(e) => {
              setFilters({ ...filters, search: e.target.value || undefined });
              setPage(1);
            }}
          />
        </div>
        {rebuild.error && (
          <Alert className="mb-3">
            {apiErrors(rebuild.error, t("common.saveFailed")).general}
          </Alert>
        )}
        <DataTable
          caption={t("record.title")}
          columns={columns}
          rows={list.data?.results ?? []}
          rowKey={(d) => String(d.id)}
          loading={list.isPending}
          empty={t("record.none")}
          minWidth={1080}
        />
        {total > 25 && (
          <Pagination
            page={page}
            pageCount={Math.ceil(total / 25)}
            onPageChange={setPage}
          />
        )}
      </Card>
    </div>
  );
}
