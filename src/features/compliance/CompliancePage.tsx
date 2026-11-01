import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CloudDownload, Eye, FileDown, KeyRound, Link2, RotateCcw, Upload, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { type ExternalRecord, type GovDataRun, govData, type GovSystem, type Integration, type IntegrationMode, type RecordStatus } from "@/api/compliance";
import { hr } from "@/api/hr";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable, PersonCell } from "@/design/DataTable";
import { Dialog } from "@/design/Dialog";
import { CheckField, FormSelect, SearchInput, TextArea, TextField } from "@/design/Field";
import { FileDrop } from "@/design/FileDrop";
import { Pagination } from "@/design/Pagination";
import { Pill, type PillTone } from "@/design/Pill";
import { Tabs } from "@/design/Tabs";
import { Page } from "@/layout/Page";
import { apiErrors } from "@/lib/apiErrors";
import { saveFile } from "@/lib/saveFile";
import { useFormat } from "@/lib/useFormat";
import { checkSpreadsheet } from "@/lib/validators";

import { EstablishmentsTab, PeopleTab } from "./EstablishmentsTab";
import { GosiTab } from "./GosiTab";
import { MuqeemTab } from "./MuqeemTab";
import { NitaqatTab, SaudizationTab } from "./NitaqatTab";
import { OverviewTab, ReportTab } from "./OverviewTab";
import { QiwaTab } from "./QiwaTab";
import { RenewalsTab } from "./RenewalsTab";
import { WpsTab } from "./WpsTab";

const TABS = ["overview", "report", "nitaqat", "saudization", "qiwa", "gosi", "wps", "muqeem", "renewals", "data", "establishments", "people", "integrations"] as const;
type Tab = (typeof TABS)[number];
/** The page's sections (the header's pills) and their tabs (the row inside); `?tab=` names the tab, the section follows. */
const GROUPS = {
  monitoring: ["overview", "report"],
  saudization: ["nitaqat", "saudization", "establishments", "people"],
  government: ["gosi", "qiwa", "wps"],
  residency: ["muqeem", "renewals"],
  sources: ["data", "integrations"],
} as const satisfies Record<string, readonly Tab[]>;
type Group = keyof typeof GROUPS;
const groupOf = (tab: Tab) => (Object.keys(GROUPS) as Group[]).find((g) => (GROUPS[g] as readonly Tab[]).includes(tab))!;
const SYSTEMS: GovSystem[] = ["gosi", "qiwa", "mudad", "muqeem"];
const RUN_TONES: Record<GovDataRun["status"], PillTone> = { checking: "sky", ready: "teal", failed: "salmon", discarded: "neutral", purged: "neutral" };
const RECORD_TONES: Record<RecordStatus, PillTone> = { matched: "green", different: "amber", unknown: "salmon", ambiguous: "salmon", missing: "lavender" };
const STATUSES: RecordStatus[] = ["different", "unknown", "ambiguous", "missing", "matched"];
const PAGE_SIZE = 25;

/** Compliance (Phase 5): Nitaqat per establishment and the Saudization report (task 4); government data (task 1, plan
 * §1): each portal's export uploaded (or, in the MOCK mode, fetched), its rows
 * matched to our employees by ID number — matched, different (field by field), not ours, missing from their list —
 * and resolved by a person; nothing of ours changes until a difference is accepted. And each system's integration. */
export default function CompliancePage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab") as Tab | null;
  const tab: Tab = requested && TABS.includes(requested) ? requested : "overview";
  const run = Number(params.get("run")) || null;
  const group = groupOf(tab);
  const show = (next: Tab) => setParams(next === "overview" ? {} : { tab: next }, { replace: true });
  return (
    <Page
      title={t("compliance.title")}
      tabs={<Tabs label={t("compliance.title")} value={group} onChange={(next) => show(GROUPS[next][0])} items={(Object.keys(GROUPS) as Group[]).map((id) => ({ id, label: t(`compliance.groups.${id}`) }))} />}
    >
      <Tabs className="mb-5" variant="segmented" label={t(`compliance.groups.${group}`)} value={tab} onChange={show} items={GROUPS[group].map((id) => ({ id: id as Tab, label: t(`compliance.tabs.${id}`) }))} />
      {tab === "overview" && <OverviewTab />}
      {tab === "report" && <ReportTab key={params.toString()} />}
      {tab === "nitaqat" && <NitaqatTab />}
      {tab === "saudization" && <SaudizationTab />}
      {tab === "qiwa" && <QiwaTab />}
      {tab === "gosi" && <GosiTab />}
      {tab === "wps" && <WpsTab />}
      {tab === "muqeem" && <MuqeemTab />}
      {tab === "renewals" && <RenewalsTab />}
      {tab === "data" && (run ? <RunReview runId={run} onBack={() => setParams({ tab: "data" }, { replace: true })} /> : <DataTab onOpen={(id) => setParams({ tab: "data", run: String(id) }, { replace: true })} />)}
      {tab === "establishments" && <EstablishmentsTab />}
      {tab === "people" && <PeopleTab />}
      {tab === "integrations" && <IntegrationsTab />}
    </Page>
  );
}

function DataTab({ onOpen }: { onOpen: (id: number) => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const { can } = useSession();
  const manage = can("compliance.manage");
  const queryClient = useQueryClient();
  const kinds = useQuery({ queryKey: ["gov-kinds", ...scope], queryFn: govData.kinds });
  const integrations = useQuery({ queryKey: ["gov-integrations", ...scope], queryFn: govData.integrations });
  const [page, setPage] = useState(1);
  const runs = useQuery({
    queryKey: ["gov-runs", page, ...scope],
    queryFn: () => govData.runs(page),
    refetchInterval: (q) => (q.state.data?.results.some((r) => r.status === "checking") ? 1_500 : false),
  });
  const [kind, setKind] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [period, setPeriod] = useState("");
  const chosen = kinds.data?.find((k) => k.code === (kind || kinds.data?.[0]?.code));
  const mode = integrations.data?.find((i) => i.system === chosen?.system)?.mode ?? "manual";
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["gov-runs"] });
  const send = useMutation({
    mutationFn: () => {
      const month = chosen!.monthly ? period : undefined;
      return mode === "manual" ? govData.upload(chosen!.code, file!, month) : govData.fetch(chosen!.code, month);
    },
    onSuccess: async () => {
      setFile(null);
      await refresh();
    },
  });
  const download = useMutation({ mutationFn: async (filled: boolean) => saveFile(await govData.template(chosen!.code, filled)) });
  const errors = apiErrors(send.error ?? download.error, t("common.saveFailed"));
  const columns: Column<GovDataRun>[] = [
    { id: "when", header: t("compliance.when"), cell: (r) => <span className="num text-sm">{format.date(r.created_at)}</span>, className: "w-36" },
    { id: "kind", header: t("compliance.kind"), cell: (r) => <span className="flex flex-col"><span className="text-sm font-medium">{r.kind_label}</span><span className="text-xs text-muted">{[r.period && format.date(r.period, "monthYear"), r.file_name || t(`compliance.modes.${r.mode}`)].filter(Boolean).join(" · ")}</span></span> },
    { id: "status", header: t("compliance.status"), cell: (r) => <Pill tone={RUN_TONES[r.status]}>{t(`compliance.runStatuses.${r.status}`)}</Pill>, className: "w-36" },
    {
      id: "counts",
      header: t("compliance.counts"),
      cell: (r) =>
        r.status === "failed" ? (
          <span className="text-sm text-danger">{r.errors[0]}</span>
        ) : (
          <span className="num flex flex-wrap gap-x-3 text-sm">
            {(["matched", "different", "unknown", "missing"] as const).map((s) => (
              <span key={s}>
                {t(`compliance.statuses.${s}`)}: {format.number(r.counts[s] ?? 0)}
              </span>
            ))}
          </span>
        ),
    },
    { id: "by", header: t("compliance.by"), cell: (r) => <span className="text-sm">{r.started_by_name}</span>, className: "w-40" },
    { id: "actions", header: <span className="sr-only">{t("common.actions")}</span>, cell: (r) => r.status === "ready" && <IconButton size="sm" variant="plain" label={t("compliance.review", { name: r.kind_label })} icon={<Eye />} onClick={() => onOpen(r.id)} /> },
  ];
  return (
    <div className="flex flex-col gap-6">
      {manage && (
        <Card variant="solid" title={t("compliance.readTitle")} subtitle={t("compliance.readHint")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormSelect label={t("compliance.kind")} name="kind" value={chosen?.code ?? ""} onChange={(e) => setKind(e.target.value)} options={(kinds.data ?? []).map((k) => ({ value: k.code, label: k.label }))} />
            <p className="self-end text-sm text-muted">
              {t(`compliance.modes.${mode}`)}
              {chosen?.note ? ` · ${chosen.note}` : ""}
            </p>
          </div>
          {chosen?.monthly && <TextField className="mt-4 sm:w-56" label={t("compliance.period")} name="period" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} error={errors.fields.period} />}
          {chosen && mode === "manual" && (
            <>
              <FileDrop className="mt-4" label={t("compliance.file")} file={file} onChange={setFile} accept=".xlsx,.csv" check={async (f) => (f.name.toLowerCase().endsWith(".csv") ? null : checkSpreadsheet(f))} limits={t("compliance.fileLimits")} error={errors.fields.file} />
              <details className="mt-3 text-sm text-muted">
                <summary className="cursor-pointer">{t("compliance.columnsHelp")}</summary>
                <ul className="mt-2 flex flex-col gap-1">
                  {chosen.fields.map((f) => (
                    <li key={f.key}>
                      <span className="font-medium text-ink">{f.label}</span>: <span dir="auto">{f.headers.join(" / ")}</span>
                    </li>
                  ))}
                </ul>
              </details>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" icon={<FileDown className="size-4" />} disabled={download.isPending} onClick={() => download.mutate(false)}>
                  {t("compliance.template")}
                </Button>
                {chosen.samples && (
                  <Button size="sm" variant="ghost" icon={<FileDown className="size-4" />} disabled={download.isPending} onClick={() => download.mutate(true)}>
                    {t("compliance.testFile")}
                  </Button>
                )}
              </div>
            </>
          )}
          {(errors.fields.detail || errors.fields.kind || errors.general) && <Alert className="mt-3">{errors.fields.detail ?? errors.fields.kind ?? errors.general}</Alert>}
          <div className="mt-4 flex justify-end">
            <Button variant="accent" icon={mode === "manual" ? <Upload className="size-4" /> : <CloudDownload className="size-4" />} disabled={!chosen || (mode === "manual" && !file) || (chosen.monthly && !period) || send.isPending} onClick={() => send.mutate()}>
              {t(mode === "manual" ? "compliance.upload" : "compliance.fetch")}
            </Button>
          </div>
        </Card>
      )}
      <Card variant="solid" title={t("compliance.runsTitle")} subtitle={t("compliance.runsHint")}>
        <DataTable caption={t("compliance.runsTitle")} columns={columns} rows={runs.data?.results ?? []} rowKey={(r) => String(r.id)} loading={runs.isPending} empty={t("compliance.noRuns")} minWidth={900} />
        {(runs.data?.count ?? 0) > PAGE_SIZE && <Pagination page={page} pageCount={Math.ceil((runs.data?.count ?? 0) / PAGE_SIZE)} onPageChange={setPage} />}
      </Card>
    </div>
  );
}

function RunReview({ runId, onBack }: { runId: number; onBack: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const { can } = useSession();
  const manage = can("compliance.manage");
  const queryClient = useQueryClient();
  const run = useQuery({ queryKey: ["gov-run", runId], queryFn: () => govData.run(runId) });
  const [status, setStatus] = useState<string>("different,unknown,ambiguous,missing");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const records = useQuery({ queryKey: ["gov-records", runId, status, search, page], queryFn: () => govData.records(runId, { status: status || undefined, search: search || undefined, page }), placeholderData: keepPreviousData });
  const [acting, setActing] = useState<{ record: ExternalRecord; action: "ignore" | "link" } | null>(null);
  const resolve = useMutation({
    mutationFn: ({ record, action }: { record: ExternalRecord; action: "accept" | "reopen" }) => govData.resolve(record.id, { action }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gov-records", runId] }),
  });
  const discard = useMutation({ mutationFn: () => govData.discard(runId), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["gov-runs"] }); onBack(); } });
  const errors = apiErrors(resolve.error ?? discard.error, t("common.saveFailed"));
  const columns: Column<ExternalRecord>[] = [
    { id: "who", header: t("compliance.employee"), cell: (r) => (r.employee_info ? <PersonCell name={format.name(r.employee_info)} subtitle={r.employee_info.employee_no} /> : <span dir="ltr" className="num text-sm">{r.external_id}</span>) },
    { id: "status", header: t("compliance.match"), cell: (r) => <Pill tone={RECORD_TONES[r.status]}>{t(`compliance.statuses.${r.status}`)}</Pill>, className: "w-40" },
    {
      id: "diff",
      header: t("compliance.differences"),
      cell: (r) =>
        r.differences.length ? (
          <ul className="flex flex-col gap-0.5 text-sm">
            {r.differences.map((d) => (
              <li key={d.field}>
                <span className="font-medium">{d.label}</span>: <span className="text-muted">{t("compliance.ours")}</span> <span dir="auto">{d.hidden ? "•••" : (d.ours ?? "—")}</span> · <span className="text-muted">{t("compliance.theirs")}</span> <span dir="auto">{d.hidden ? "•••" : (d.theirs ?? "—")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    { id: "resolution", header: t("compliance.resolution"), cell: (r) => <span className="flex flex-col text-sm"><span>{t(`compliance.resolutions.${r.resolution}`)}</span>{r.note && <span className="text-xs text-muted">{r.note}</span>}</span>, className: "w-40" },
    {
      id: "actions",
      header: <span className="sr-only">{t("common.actions")}</span>,
      cell: (r) =>
        manage && (
          <span className="flex gap-1">
            {r.resolution === "open" ? (
              <>
                {r.status === "different" && <IconButton size="sm" variant="plain" label={t("compliance.accept")} icon={<Check />} onClick={() => resolve.mutate({ record: r, action: "accept" })} />}
                {(r.status === "unknown" || r.status === "ambiguous") && <IconButton size="sm" variant="plain" label={t("compliance.link")} icon={<Link2 />} onClick={() => setActing({ record: r, action: "link" })} />}
                {r.status !== "matched" && <IconButton size="sm" variant="plain" label={t("compliance.ignore")} icon={<X />} onClick={() => setActing({ record: r, action: "ignore" })} />}
              </>
            ) : (
              <IconButton size="sm" variant="plain" label={t("compliance.reopen")} icon={<RotateCcw />} onClick={() => resolve.mutate({ record: r, action: "reopen" })} />
            )}
          </span>
        ),
    },
  ];
  return (
    <Card
      variant="solid"
      title={run.data?.kind_label ?? t("common.loading")}
      subtitle={run.data ? `${format.date(run.data.created_at)} · ${run.data.file_name || t(`compliance.modes.${run.data.mode}`)}` : undefined}
      action={
        <span className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onBack}>
            {t("compliance.back")}
          </Button>
          {manage && (
            <Button size="sm" variant="ghost" disabled={discard.isPending} onClick={() => discard.mutate()}>
              {t("compliance.discard")}
            </Button>
          )}
        </span>
      }
    >
      <Alert tone="info" className="mb-4">{t("compliance.nothingChanges")}</Alert>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <FormSelect label={t("compliance.match")} name="status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} options={[{ value: "different,unknown,ambiguous,missing", label: t("compliance.toReview") }, { value: "", label: t("compliance.all") }, ...STATUSES.map((s) => ({ value: s, label: t(`compliance.statuses.${s}`) }))]} className="w-full sm:w-56" />
        <SearchInput label={t("common.search")} placeholder={t("common.searchPlaceholder")} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="w-full sm:w-72" />
      </div>
      {(errors.fields.detail || errors.general) && <Alert className="mb-3">{errors.fields.detail ?? errors.general}</Alert>}
      <DataTable caption={t("compliance.rowsTitle")} columns={columns} rows={records.data?.results ?? []} rowKey={(r) => String(r.id)} loading={records.isPending} empty={t("compliance.noRows")} minWidth={960} />
      {(records.data?.count ?? 0) > PAGE_SIZE && <Pagination page={page} pageCount={Math.ceil((records.data?.count ?? 0) / PAGE_SIZE)} onPageChange={setPage} />}
      {acting && <ActDialog record={acting.record} action={acting.action} runId={runId} onClose={() => setActing(null)} />}
    </Card>
  );
}

function ActDialog({ record, action, runId, onClose }: { record: ExternalRecord; action: "ignore" | "link"; runId: number; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [employee, setEmployee] = useState("");
  const [search, setSearch] = useState(record.external_id);
  const found = useQuery({ queryKey: ["gov-people", search, ...scope], queryFn: () => hr.searchEmployees(search), enabled: action === "link", placeholderData: keepPreviousData });
  const save = useMutation({
    mutationFn: () => govData.resolve(record.id, { action, note, ...(employee ? { employee: Number(employee) } : {}) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["gov-records", runId] });
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      onClose={onClose}
      title={t(`compliance.${action}`)}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={save.isPending || (action === "link" ? !employee : !note.trim())} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          <span dir="ltr" className="num">{record.external_id}</span>
          {Object.entries(record.data)
            .filter(([key, value]) => key !== "id_number" && value)
            .map(([key, value]) => ` · ${key}: ${value}`)
            .join("")}
        </p>
        {action === "link" && (
          <>
            <TextField label={t("compliance.findEmployee")} type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
            <FormSelect label={t("compliance.employee")} name="employee" value={employee} placeholder={t("common.choose")} onChange={(e) => setEmployee(e.target.value)} options={(found.data?.results ?? []).map((e) => ({ value: String(e.id), label: `${format.name(e)} · ${e.employee_no}` }))} />
          </>
        )}
        <TextArea label={t(action === "ignore" ? "compliance.whyIgnore" : "compliance.note")} name="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        {(errors.fields.detail || errors.general) && <Alert>{errors.fields.detail ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

function IntegrationsTab() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const { can } = useSession();
  const integrations = useQuery({ queryKey: ["gov-integrations", ...scope], queryFn: govData.integrations });
  const [editing, setEditing] = useState<Integration | null>(null);
  const columns: Column<Integration>[] = [
    { id: "system", header: t("compliance.system"), cell: (i) => <span className="font-medium">{t(`compliance.systems.${i.system}`)}</span>, className: "w-40" },
    { id: "mode", header: t("compliance.mode"), cell: (i) => <Pill tone={i.mode === "manual" ? "neutral" : i.mode === "mock" ? "lavender" : "teal"}>{t(`compliance.modes.${i.mode}`)}</Pill>, className: "w-44" },
    { id: "credentials", header: t("compliance.credentials"), cell: (i) => <span className="text-sm">{i.credentials_set ? t("compliance.credentialsSet", { names: i.credential_keys.join(", ") }) : "—"}</span> },
    { id: "last", header: t("compliance.lastRead"), cell: (i) => <span className="num text-sm">{i.last_sync_at ? format.date(i.last_sync_at) : "—"}</span>, className: "w-36" },
    { id: "actions", header: <span className="sr-only">{t("common.actions")}</span>, cell: (i) => can("compliance.manage_integrations") && <IconButton size="sm" variant="plain" label={t("compliance.configure", { name: t(`compliance.systems.${i.system}`) })} icon={<KeyRound />} onClick={() => setEditing(i)} /> },
  ];
  return (
    <Card variant="solid" title={t("compliance.integrationsTitle")} subtitle={t("compliance.integrationsHint")}>
      <DataTable caption={t("compliance.integrationsTitle")} columns={columns} rows={(integrations.data ?? []).sort((a, b) => SYSTEMS.indexOf(a.system) - SYSTEMS.indexOf(b.system))} rowKey={(i) => i.system} loading={integrations.isPending} minWidth={720} />
      {editing && <IntegrationDialog integration={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function IntegrationDialog({ integration, onClose }: { integration: Integration; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [v, setV] = useState({ mode: integration.mode, base_url: integration.base_url, is_active: integration.is_active });
  const [secrets, setSecrets] = useState({ username: "", password: "", api_key: "" });
  const [clear, setClear] = useState(false);
  const save = useMutation({
    mutationFn: () => {
      const given = Object.fromEntries(Object.entries(secrets).filter(([, value]) => value));
      const credentials = clear ? null : Object.keys(given).length ? given : undefined;
      return govData.saveIntegration(integration.system, { ...v, ...(credentials !== undefined ? { credentials } : {}) });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["gov-integrations"] });
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("compliance.configure", { name: t(`compliance.systems.${integration.system}`) })}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormSelect label={t("compliance.mode")} name="mode" value={v.mode} onChange={(e) => setV({ ...v, mode: e.target.value as IntegrationMode })} options={(["manual", "api", "mock"] as const).map((m) => ({ value: m, label: t(`compliance.modes.${m}`) }))} hint={t(`compliance.modeHints.${v.mode}`)} />
        {v.mode === "api" && (
          <>
            <TextField label={t("compliance.baseUrl")} name="base_url" dir="ltr" value={v.base_url} onChange={(e) => setV({ ...v, base_url: e.target.value })} error={errors.fields.base_url} />
            <p className="text-sm text-muted">{integration.credentials_set ? t("compliance.credentialsKept") : t("compliance.credentialsNone")}</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField label={t("compliance.username")} name="username" dir="ltr" autoComplete="off" value={secrets.username} onChange={(e) => setSecrets({ ...secrets, username: e.target.value })} />
              <TextField label={t("compliance.password")} name="password" type="password" dir="ltr" autoComplete="new-password" value={secrets.password} onChange={(e) => setSecrets({ ...secrets, password: e.target.value })} />
              <TextField label={t("compliance.apiKey")} name="api_key" type="password" dir="ltr" autoComplete="off" value={secrets.api_key} onChange={(e) => setSecrets({ ...secrets, api_key: e.target.value })} />
            </div>
            {integration.credentials_set && <CheckField label={t("compliance.clearCredentials")} checked={clear} onChange={(e) => setClear(e.target.checked)} />}
          </>
        )}
        <CheckField label={t("compliance.active")} checked={v.is_active} onChange={(e) => setV({ ...v, is_active: e.target.checked })} />
        {(errors.fields.credentials || errors.general) && <Alert>{errors.fields.credentials ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
