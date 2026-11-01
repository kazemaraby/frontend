import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Fingerprint } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { attendanceBoard, type BoardRow } from "@/api/attendance";
import { hr } from "@/api/hr";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable, PersonCell } from "@/design/DataTable";
import { DateInput } from "@/design/DateInput";
import { FormSelect, SearchInput } from "@/design/Field";
import { KpiTile } from "@/design/KpiTile";
import { Pill } from "@/design/Pill";
import { toISODate } from "@/lib/format";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

import { hm } from "./clock";
import { EnterDialog } from "./DevicesTab";
import { DOTS } from "./ShiftsTab";
import { DAY_TONES } from "./tones";

const GROUPS = ["at_work", "late", "missing", "away"] as const;

/** The "today" tab (Phase 3 task 16): everyone's day now — the shift, the status, first in / last out and how the first
 * punch came — with the day's tiles. A past day comes from the record. HR enters a missing punch with a reason. */
export function TodayTab() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const { can } = useSession();
  const today = toISODate(new Date());
  const [date, setDate] = useState(today);
  const [filters, setFilters] = useState<{ department?: number; search?: string; status?: string }>({});
  const [entering, setEntering] = useState<BoardRow | null>(null);
  const board = useQuery({
    queryKey: ["attendance-board", date, filters, ...scope],
    queryFn: () => attendanceBoard.get({ date, ...filters }),
    placeholderData: keepPreviousData,
    refetchInterval: date === today ? 60_000 : false,
  });
  const departments = useQuery({ queryKey: ["setup", "departments", ...scope], queryFn: hr.departmentRows });
  const counts = board.data?.counts ?? {};
  const name = (r: BoardRow) => format.name(r.employee);

  const status = (r: BoardRow) => {
    const label = r.covers[0] && ["leave", "mission", "trip", "remote"].includes(r.status) ? format.pick(r.covers[0]) : t(`record.status.${r.status}`);
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        <Pill tone={DAY_TONES[r.status]}>{label}</Pill>
        {r.late_minutes > 0 && <span className="num text-xs text-muted">{t("today.lateBy", { time: hm(r.late_minutes) })}</span>}
        {r.flags.includes("missing_out") && r.status !== "working" && <span className="text-xs text-danger">{t("today.missingOut")}</span>}
      </span>
    );
  };
  const columns: Column<BoardRow>[] = [
    { id: "no", header: t("attendance.columns.number"), cell: (r) => <span className="num font-semibold">{r.employee.employee_no}</span>, className: "w-28" },
    { id: "name", header: t("attendance.columns.name"), cell: (r) => <PersonCell name={name(r)} subtitle={r.department} /> },
    {
      id: "shift",
      header: t("attendance.columns.shift"),
      cell: (r) =>
        r.shift ? (
          <span className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-sm">
              <span aria-hidden="true" className={`size-2 rounded-full ${DOTS[r.shift.color]}`} />
              {format.name(r.shift)}
            </span>
            <span dir="ltr" className="num text-xs text-muted">
              {r.shift.hours}
            </span>
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    { id: "status", header: t("attendance.columns.today"), cell: status },
    {
      id: "times",
      header: t("today.inOut"),
      cell: (r) =>
        r.first_in || r.last_out ? (
          <span dir="ltr" className="num text-sm">
            {r.first_in || "—"} – {r.last_out || "—"}
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    { id: "worked", header: t("today.worked"), cell: (r) => <span className="num">{r.worked_minutes ? hm(r.worked_minutes) : "—"}</span> },
    {
      id: "source",
      header: t("attendance.columns.source"),
      cell: (r) =>
        r.source ? (
          <span className="flex flex-col text-sm">
            <span>{r.source.name || t(`devices.sources.${r.source.kind}`)}</span>
            {r.source.terminal && <span className="text-xs text-muted">{r.source.terminal}</span>}
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    ...(can("attendance.manage")
      ? [
          {
            id: "actions",
            header: <span className="sr-only">{t("common.actions")}</span>,
            cell: (r: BoardRow) => (
              <Button size="sm" variant="ghost" icon={<Fingerprint className="size-4" />} onClick={() => setEntering(r)} aria-label={t("today.enterFor", { name: name(r) })}>
                {t("devices.enter")}
              </Button>
            ),
          },
        ]
      : []),
  ];
  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiTile label={t("attendance.kpi.present")} value={format.number(counts.at_work ?? 0)} tone="green" />
        <KpiTile label={t("attendance.kpi.late")} value={format.number(counts.late ?? 0)} tone="amber" />
        <KpiTile label={t("attendance.kpi.absent")} value={format.number(counts.missing ?? 0)} tone="red" />
        <KpiTile label={t("attendance.kpi.away")} value={format.number(counts.away ?? 0)} tone="violet" />
      </div>
      <Card>
        <div className="mb-3 grid gap-3 md:grid-cols-4">
          <DateInput label={t("record.date")} name="date" value={date} max={today} onChange={(d) => d && setDate(d)} />
          <FormSelect
            label={t("approvals.columns.status")}
            name="status"
            value={filters.status ?? ""}
            placeholder={t("record.everyStatus")}
            options={GROUPS.map((g) => ({ value: g, label: t(`today.groups.${g}`) }))}
            onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
          />
          <FormSelect
            label={t("leaveReport.department")}
            name="department"
            value={String(filters.department ?? "")}
            placeholder={t("leaveReport.everyDepartment")}
            options={(departments.data?.results ?? []).map((d) => ({ value: String(d.id), label: format.name(d) }))}
            onChange={(e) => setFilters({ ...filters, department: e.target.value ? Number(e.target.value) : undefined })}
          />
          <SearchInput label={t("roster.search")} className="self-end" value={filters.search ?? ""} onChange={(e) => setFilters({ ...filters, search: e.target.value || undefined })} />
        </div>
        {board.isError && <Alert>{apiErrors(board.error, t("common.loadFailed")).general}</Alert>}
        <DataTable
          caption={t("today.title")}
          columns={columns}
          rows={board.data?.rows ?? []}
          rowKey={(r) => String(r.employee.id)}
          loading={board.isPending}
          empty={t("today.nobody")}
          minWidth={1040}
        />
      </Card>
      {entering && <EnterDialog person={{ id: entering.employee.id, label: `${name(entering)} · ${entering.employee.employee_no}` }} day={date} onClose={() => setEntering(null)} />}
    </>
  );
}
