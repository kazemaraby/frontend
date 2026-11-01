import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stamp } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type ExitReentryRequest, exitReentryApi, type Visa, type VisaKind, visasApi, type VisaStatus } from "@/api/compliance";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable, PersonCell } from "@/design/DataTable";
import { DateInput } from "@/design/DateInput";
import { Dialog } from "@/design/Dialog";
import { FormSelect, SearchInput, TextField } from "@/design/Field";
import { FileDrop } from "@/design/FileDrop";
import { Money } from "@/design/Money";
import { Pagination } from "@/design/Pagination";
import { Pill, type PillTone } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

const KINDS: VisaKind[] = ["exit_reentry_single", "exit_reentry_multiple", "final_exit"];
const STATUSES: VisaStatus[] = ["requested", "issued", "used", "returned", "cancelled", "expired"];
const STATUS_TONES: Record<VisaStatus, PillTone> = { requested: "amber", issued: "teal", used: "orange", returned: "green", cancelled: "neutral", expired: "salmon" };
const PAGE_SIZE = 25;

/** Muqeem (Phase 5 task 9, #106): the visas read from Muqeem's visa list (Hijri dates alongside), for the employees
 * whose personal data the user may see. The residents report is reviewed in "Imports and review": accepting a
 * difference updates the iqama or passport document. */
export function MuqeemTab() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const list = useQuery({
    queryKey: ["visas", status, kind, search, page, ...scope],
    queryFn: () => visasApi.list({ status: status || undefined, kind: kind || undefined, search: search || undefined, page }),
    placeholderData: keepPreviousData,
  });
  const day = (iso: string | null, hijri: string | null) =>
    iso ? (
      <span className="flex flex-col">
        <span className="num whitespace-nowrap text-sm">{format.date(iso)}</span>
        {hijri && <span className="num whitespace-nowrap text-xs text-muted">{format.hijri(iso)}</span>}
      </span>
    ) : (
      <span className="text-muted">—</span>
    );
  const columns: Column<Visa>[] = [
    { id: "who", header: t("compliance.employee"), cell: (v) => <PersonCell name={format.name(v.employee_info)} subtitle={v.employee_info.employee_no} /> },
    {
      id: "kind",
      header: t("muqeem.kind"),
      cell: (v) => (
        <span className="flex flex-col items-start text-sm">
          <span>{t(`muqeem.kinds.${v.kind}`)}</span>
          <bdi dir="ltr" className="num text-xs text-muted">{v.number || "—"}</bdi>
        </span>
      ),
    },
    { id: "status", header: t("muqeem.status"), cell: (v) => <Pill tone={STATUS_TONES[v.status]}>{t(`muqeem.statuses.${v.status}`)}</Pill>, className: "w-40" },
    { id: "issued", header: t("muqeem.issued"), cell: (v) => day(v.issued_on, v.issued_on), className: "w-36" },
    { id: "valid", header: t("muqeem.validUntil"), cell: (v) => day(v.valid_until, v.valid_until_hijri), className: "w-36" },
    { id: "return", header: t("muqeem.returnBy"), cell: (v) => day(v.return_by, v.return_by_hijri), className: "w-36" },
  ];
  const errors = apiErrors(list.error, t("common.loadFailed"));
  return (
    <div className="flex flex-col gap-6">
      <Alert tone="info">{t("muqeem.residentsHint")}</Alert>
      <ToIssueCard />
      <Card variant="solid" title={t("muqeem.visasTitle")} subtitle={t("muqeem.visasHint")}>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <FormSelect label={t("muqeem.kind")} name="kind" value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }} options={[{ value: "", label: t("compliance.all") }, ...KINDS.map((k) => ({ value: k, label: t(`muqeem.kinds.${k}`) }))]} className="w-full sm:w-56" />
          <FormSelect label={t("muqeem.status")} name="status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} options={[{ value: "", label: t("compliance.all") }, ...STATUSES.map((s) => ({ value: s, label: t(`muqeem.statuses.${s}`) }))]} className="w-full sm:w-48" />
          <SearchInput label={t("common.search")} placeholder={t("common.searchPlaceholder")} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="w-full sm:w-72" />
        </div>
        {list.isError && <Alert className="mb-3">{errors.general}</Alert>}
        <DataTable caption={t("muqeem.visasTitle")} columns={columns} rows={list.data?.results ?? []} rowKey={(v) => String(v.id)} loading={list.isPending} empty={t("muqeem.noVisas")} minWidth={900} />
        {(list.data?.count ?? 0) > PAGE_SIZE && <Pagination page={page} pageCount={Math.ceil((list.data?.count ?? 0) / PAGE_SIZE)} onPageChange={setPage} />}
      </Card>
    </div>
  );
}

/** Exit re-entry requests approved and waiting for HR to issue the visa in Muqeem (Phase 5 task 10): HR records the
 * number, the dates, the fee charged and the scan; the employee is told. */
function ToIssueCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const { can } = useSession();
  const list = useQuery({ queryKey: ["exit-reentry", "to-issue", ...scope], queryFn: () => exitReentryApi.list({ to_issue: "1" }) });
  const [issuing, setIssuing] = useState<ExitReentryRequest | null>(null);
  if (!list.data?.count) return null;
  const columns: Column<ExitReentryRequest>[] = [
    { id: "who", header: t("compliance.employee"), cell: (r) => (r.employee_info ? <PersonCell name={format.name(r.employee_info)} subtitle={r.employee_info.employee_no} /> : null) },
    { id: "kind", header: t("muqeem.kind"), cell: (r) => <span className="text-sm">{t(`muqeem.kinds.${r.kind}`)}</span> },
    { id: "dates", header: t("exitReentry.dates"), cell: (r) => <span className="num whitespace-nowrap text-sm">{format.dateRange(r.leave_on, r.back_on)}</span> },
    {
      id: "payer",
      header: t("exitReentry.payer"),
      cell: (r) => (
        <span className="flex flex-col text-sm">
          <span>{t(`exitReentry.payers.${r.payer || "company"}`)}</span>
          {r.fee && <Money amount={r.fee} />}
        </span>
      ),
    },
    { id: "warnings", header: t("exitReentry.warnings"), cell: (r) => (r.warnings.length ? <span className="text-sm text-amber-800">{r.warnings.join(t("common.listSeparator"))}</span> : <span className="text-muted">—</span>) },
    {
      id: "actions",
      header: <span className="sr-only">{t("common.actions")}</span>,
      cell: (r) => can("compliance.manage") && <IconButton size="sm" variant="plain" label={t("exitReentry.issue", { name: r.employee_info ? format.name(r.employee_info) : "" })} icon={<Stamp />} onClick={() => setIssuing(r)} />,
    },
  ];
  return (
    <Card variant="solid" title={t("exitReentry.toIssueTitle")} subtitle={t("exitReentry.toIssueHint")}>
      <DataTable caption={t("exitReentry.toIssueTitle")} columns={columns} rows={list.data.results} rowKey={(r) => String(r.id)} minWidth={900} />
      {issuing && <IssueDialog request={issuing} onClose={() => setIssuing(null)} />}
    </Card>
  );
}

function IssueDialog({ request, onClose }: { request: ExitReentryRequest; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const [v, setV] = useState({ number: "", issued_on: new Date().toLocaleDateString("en-CA"), valid_until: "", return_by: request.back_on, fee: request.fee ?? "" });
  const [file, setFile] = useState<File | null>(null);
  const save = useMutation({
    mutationFn: () => exitReentryApi.issue(request.id, v, file),
    onSuccess: async () => {
      await Promise.all(["exit-reentry", "visas"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("exitReentry.issue", { name: request.employee_info ? format.name(request.employee_info) : "" })}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={save.isPending || !v.number || !v.valid_until} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("exitReentry.number")} name="number" dir="ltr" value={v.number} onChange={(e) => setV({ ...v, number: e.target.value })} />
          <TextField label={t("exitReentry.feeCharged")} name="fee" type="number" min={0} inputMode="decimal" dir="ltr" value={v.fee} onChange={(e) => setV({ ...v, fee: e.target.value })} error={errors.fields.fee} />
          <DateInput label={t("exitReentry.issuedOn")} name="issued_on" value={v.issued_on || null} onChange={(d) => setV({ ...v, issued_on: d ?? "" })} error={errors.fields.issued_on} />
          <DateInput label={t("exitReentry.validUntil")} name="valid_until" hijri value={v.valid_until || null} onChange={(d) => setV({ ...v, valid_until: d ?? "" })} error={errors.fields.valid_until} />
          <DateInput label={t("exitReentry.returnBy")} name="return_by" hijri value={v.return_by || null} onChange={(d) => setV({ ...v, return_by: d ?? "" })} />
        </div>
        <FileDrop label={t("exitReentry.scan")} file={file} onChange={setFile} accept=".pdf,.jpg,.jpeg,.png" limits={t("exitReentry.scanLimits")} />
        {(errors.fields.detail || errors.general) && <Alert>{errors.fields.detail ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
