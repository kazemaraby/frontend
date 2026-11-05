import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Camera, Copy, Cpu, FileSpreadsheet, KeyRound, Link2, Pencil, PlugZap, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import {
  type Connector,
  type ConnectorKind,
  type DeviceUser,
  type Punch,
  type PunchKind,
  punches,
} from "@/api/attendance";
import { hr } from "@/api/hr";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { Dialog } from "@/design/Dialog";
import { CheckField, FormSelect, TextArea, TextField } from "@/design/Field";
import { Pagination } from "@/design/Pagination";
import { Pill } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

import { SyncLogCard } from "./SyncLogCard";

const KINDS: PunchKind[] = ["in", "out", "break_start", "break_end"];

/** A punch's time where it was made (the branch's time zone), not the reader's. */
function usePunchTime() {
  const { i18n } = useTranslation();
  const locale = i18n.language === "ar" ? "ar-u-nu-latn-ca-gregory" : "en-GB";
  return (p: Punch) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: p.time_zone || undefined,
    }).format(new Date(p.punched_at));
}

/** Devices (Phase 3 task 4): the BioTime / BioStar connections and their tokens, the people on the device servers
 * and the employee each one is, and the punches as they arrived (HR enters one by hand with a reason). */
export function DevicesTab() {
  const { can } = useSession();
  return (
    <div className="flex flex-col gap-4">
      {can("attendance.manage") && (
        <>
          <ConnectorsCard />
          <DeviceUsersCard />
          <SyncLogCard />
        </>
      )}
      <PunchesCard />
    </div>
  );
}

function ConnectorsCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const list = useQuery({
    queryKey: ["connectors", ...scope],
    queryFn: punches.connectors,
  });
  const [editing, setEditing] = useState<Connector | "new" | null>(null);
  const [shown, setShown] = useState<{ name: string; token: string } | null>(
    null,
  );
  const queryClient = useQueryClient();
  const [testing, setTesting] = useState<Connector | null>(null);
  const [runsOf, setRunsOf] = useState<Connector | null>(null);
  const [terminalsOf, setTerminalsOf] = useState<Connector | null>(null);
  const read = useMutation({
    mutationFn: (c: Connector) => punches.read(c.id),
    onSuccess: () => {
      // the read runs in the background: look again in a few seconds
      window.setTimeout(() => void queryClient.invalidateQueries({ queryKey: ["connectors"] }), 3000);
      window.setTimeout(() => void queryClient.invalidateQueries({ queryKey: ["punches"] }), 3000);
    },
  });
  const token = useMutation({
    mutationFn: (c: Connector) =>
      punches.token(c.id).then((r) => ({ name: c.name, token: r.token })),
    onSuccess: async (r) => {
      setShown(r);
      await queryClient.invalidateQueries({ queryKey: ["connectors"] });
    },
  });
  return (
    <Card
      variant="solid"
      title={t("devices.connectors")}
      subtitle={t("devices.connectorsHint")}
      action={
        <Button
          size="sm"
          variant="accent"
          icon={<Plus className="size-4" />}
          onClick={() => setEditing("new")}
        >
          {t("devices.addConnector")}
        </Button>
      }
    >
      {list.isSuccess && list.data.length === 0 ? (
        <p className="text-sm text-muted">{t("devices.noConnectors")}</p>
      ) : (
        <ul
          aria-label={t("devices.connectors")}
          className="flex flex-col divide-y divide-line"
        >
          {(list.data ?? []).map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="flex min-w-48 flex-col">
                <span className="font-semibold text-ink">{c.name}</span>
                <span className="text-sm text-muted">
                  {t(`devices.kinds.${c.kind}`)} ·{" "}
                  {t(`devices.modes.${c.mode}`)}
                </span>
              </span>
              <span className="num text-sm text-muted" dir="ltr">
                {c.time_zone}
              </span>
              <span className="text-sm">
                {c.last_seen_at
                  ? t("devices.lastSeen", {
                      ago: format.relative(c.last_seen_at),
                    })
                  : t("devices.neverSeen")}
              </span>
              <Pill tone={c.unmapped ? "amber" : "teal"}>
                {t("devices.people", { count: c.people, unmapped: c.unmapped })}
              </Pill>
              {!c.is_active && (
                <Pill tone="navy">{t("leaveSettings.off")}</Pill>
              )}
              {c.offline && (
                <Pill tone="salmon">{c.last_contact_at ? t("devices.offlineSince", { ago: format.relative(c.last_contact_at) }) : t("devices.offlineNever")}</Pill>
              )}
              {c.last_run && (
                <button type="button" className="cursor-pointer" onClick={() => setRunsOf(c)}>
                  <Pill tone={c.last_run.status === "failed" ? "salmon" : c.last_run.status === "running" ? "amber" : "green"}>
                    {t(`devices.runStatus.${c.last_run.status}`, { ago: format.relative(c.last_run.started_at) })}
                  </Pill>
                </button>
              )}
              <span className="ms-auto flex items-center gap-1">
                <Button size="sm" variant="ghost" icon={<Cpu className="size-4" />} onClick={() => setTerminalsOf(c)}>
                  {t("devices.terminals")}
                </Button>
                {c.mode === "cloud" ? (
                  <>
                    <Button size="sm" variant="outline" icon={<PlugZap className="size-4" />} onClick={() => setTesting(c)}>
                      {t("devices.test")}
                    </Button>
                    <Button size="sm" variant="outline" icon={<RefreshCw className="size-4" />} disabled={read.isPending || !c.is_active} onClick={() => read.mutate(c)}>
                      {t("devices.readNow")}
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<KeyRound className="size-4" />}
                    disabled={token.isPending}
                    onClick={() => token.mutate(c)}
                  >
                    {c.token_hint
                      ? t("devices.newToken")
                      : t("devices.makeToken")}
                  </Button>
                )}
                <IconButton
                  size="sm"
                  variant="plain"
                  label={t("common.editNamed", { name: c.name })}
                  icon={<Pencil />}
                  onClick={() => setEditing(c)}
                />
              </span>
              {c.mode === "agent" && c.agent_version && (
                <p className="basis-full text-sm text-muted">
                  {t("devices.agentState", { version: c.agent_version, count: c.agent_queued })}
                  {c.last_success_at && ` · ${t("devices.agentRead", { ago: format.relative(c.last_success_at) })}`}
                </p>
              )}
              {c.last_error && (
                <p role="status" className="basis-full text-sm text-danger">
                  {c.last_error}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {testing && <TestDialog connector={testing} onClose={() => setTesting(null)} />}
      {runsOf && <RunsDialog connector={runsOf} onClose={() => setRunsOf(null)} />}
      {terminalsOf && <TerminalsDialog connector={terminalsOf} onClose={() => setTerminalsOf(null)} />}
      {editing && (
        <ConnectorDialog
          connector={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {shown && <TokenDialog {...shown} onClose={() => setShown(null)} />}
    </Card>
  );
}

function TokenDialog({
  name,
  token,
  onClose,
}: {
  name: string;
  token: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("devices.tokenTitle", { name })}
      footer={<Button onClick={onClose}>{t("common.close")}</Button>}
    >
      <div className="flex flex-col gap-3">
        <Alert tone="warning">{t("devices.tokenOnce")}</Alert>
        <code
          dir="ltr"
          className="block break-all rounded-card bg-neutral-soft p-3 text-sm"
          aria-label={t("devices.token")}
        >
          {token}
        </code>
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          icon={<Copy className="size-4" />}
          onClick={() => {
            void navigator.clipboard?.writeText(token);
            setCopied(true);
          }}
        >
          {copied ? t("devices.copied") : t("devices.copy")}
        </Button>
        <p className="text-sm text-muted">{t("devices.tokenUse")}</p>
      </div>
    </Dialog>
  );
}

function ConnectorDialog({
  connector,
  onClose,
}: {
  connector?: Connector;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const queryClient = useQueryClient();
  const branches = useQuery({
    queryKey: ["master", "branches", ...scope],
    queryFn: hr.branches,
  });
  const [v, setV] = useState({
    name: connector?.name ?? "",
    kind: connector?.kind ?? ("biotime" as ConnectorKind),
    mode: connector?.mode ?? ("agent" as Connector["mode"]),
    branch: connector?.branch ? String(connector.branch) : "",
    is_active: connector?.is_active ?? true,
    base_url: connector?.base_url ?? "",
    username: connector?.username ?? "",
    password: "",
    verify_tls: connector?.verify_tls ?? true,
    poll_minutes: String(connector?.poll_minutes ?? 5),
    event_codes: connector?.event_codes ?? "",
  });
  const save = useMutation({
    mutationFn: () => {
      const { password, poll_minutes, ...rest } = v;
      return punches.saveConnector(
        {
          ...rest,
          branch: v.branch ? Number(v.branch) : null,
          poll_minutes: Number(poll_minutes) || 5,
          ...(password ? { password } : {}), // empty: the kept password stays
        },
        connector?.id,
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["connectors"] });
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      onClose={onClose}
      title={connector ? t("devices.editConnector") : t("devices.addConnector")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={!v.name.trim() || save.isPending}
            onClick={() => save.mutate()}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          className="sm:col-span-2"
          label={t("devices.name")}
          name="name"
          value={v.name}
          onChange={(e) => setV({ ...v, name: e.target.value })}
          error={errors.fields.name}
          required
        />
        <FormSelect
          label={t("devices.kind")}
          name="kind"
          value={v.kind}
          onChange={(e) =>
            setV({ ...v, kind: e.target.value as ConnectorKind })
          }
          options={(["biotime", "biostar"] as const).map((k) => ({
            value: k,
            label: t(`devices.kinds.${k}`),
          }))}
        />
        <FormSelect
          label={t("devices.mode")}
          name="mode"
          value={v.mode}
          onChange={(e) =>
            setV({ ...v, mode: e.target.value as Connector["mode"] })
          }
          options={(["agent", "cloud"] as const).map((k) => ({
            value: k,
            label: t(`devices.modes.${k}`),
          }))}
        />
        <FormSelect
          className="sm:col-span-2"
          label={t("devices.branch")}
          name="branch"
          value={v.branch}
          placeholder={t("devices.mainBranch")}
          onChange={(e) => setV({ ...v, branch: e.target.value })}
          options={(branches.data?.results ?? []).map((b) => ({
            value: String(b.id),
            label: format.name(b),
          }))}
          hint={t("devices.branchHint")}
        />
        {v.mode === "cloud" && (
          <fieldset className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
            <legend className="mb-2 font-semibold text-ink">{t("devices.cloudTitle")}</legend>
            <p className="text-sm text-muted sm:col-span-2">{t("devices.cloudHint")}</p>
            <TextField className="sm:col-span-2" label={t("devices.baseUrl")} name="base_url" dir="ltr" inputMode="url" placeholder="https://biotime.example.com:8443" value={v.base_url} onChange={(e) => setV({ ...v, base_url: e.target.value })} error={errors.fields.base_url} />
            <TextField label={t("devices.username")} name="username" dir="ltr" autoComplete="off" value={v.username} onChange={(e) => setV({ ...v, username: e.target.value })} error={errors.fields.username} />
            <TextField
              label={t("devices.password")}
              name="password"
              type="password"
              dir="ltr"
              autoComplete="new-password"
              placeholder={connector?.has_password ? t("devices.passwordKept") : ""}
              value={v.password}
              onChange={(e) => setV({ ...v, password: e.target.value })}
              error={errors.fields.password}
            />
            <TextField label={t("devices.pollMinutes")} name="poll_minutes" dir="ltr" inputMode="numeric" value={v.poll_minutes} onChange={(e) => setV({ ...v, poll_minutes: e.target.value })} error={errors.fields.poll_minutes} />
            <CheckField label={t("devices.verifyTls")} checked={v.verify_tls} onChange={(e) => setV({ ...v, verify_tls: e.target.checked })} />
            {v.kind === "biostar" && (
              <TextField className="sm:col-span-2" label={t("devices.eventCodes")} name="event_codes" dir="ltr" placeholder="4096-4111, 4864-4879" value={v.event_codes} onChange={(e) => setV({ ...v, event_codes: e.target.value })} hint={t("devices.eventCodesHint")} error={errors.fields.event_codes} />
            )}
            {!v.verify_tls && <Alert tone="warning" className="sm:col-span-2">{t("devices.verifyTlsOff")}</Alert>}
          </fieldset>
        )}
        <CheckField
          label={t("leaveSettings.active")}
          checked={v.is_active}
          onChange={(e) => setV({ ...v, is_active: e.target.checked })}
        />
        {errors.general && (
          <Alert className="sm:col-span-2">{errors.general}</Alert>
        )}
      </div>
    </Dialog>
  );
}

function DeviceUsersCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const [unmapped, setUnmapped] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [linking, setLinking] = useState<DeviceUser | null>(null);
  const navigate = useNavigate();
  const list = useQuery({
    queryKey: ["device-users", unmapped, search, page, ...scope],
    queryFn: () =>
      punches.deviceUsers({
        unmapped: unmapped ? 1 : undefined,
        search: search || undefined,
        page,
      }),
    placeholderData: keepPreviousData,
  });
  const connectors = useQuery({ queryKey: ["connectors", ...scope], queryFn: punches.connectors });
  const connectorName = new Map((connectors.data ?? []).map((c) => [c.id, c.name]));
  const columns: Column<DeviceUser>[] = [
    {
      id: "connector",
      header: t("syncLog.connection"),
      cell: (u) => <span className="text-sm">{connectorName.get(u.connector) ?? "—"}</span>,
    },
    {
      id: "id",
      header: t("devices.externalId"),
      cell: (u) => (
        <span className="num font-semibold" dir="ltr">
          {u.external_id}
        </span>
      ),
    },
    {
      id: "name",
      header: t("devices.nameOnServer"),
      cell: (u) => u.name || <span className="text-muted">—</span>,
    },
    {
      id: "punches",
      header: t("devices.punchCount"),
      cell: (u) => <span className="num">{format.number(u.punches)}</span>,
    },
    {
      id: "employee",
      header: t("devices.employee"),
      cell: (u) =>
        u.employee ? (
          <span className="flex flex-col">
            <span className="font-medium text-ink">
              {format.name(u.employee)}
            </span>
            <span className="num text-xs text-muted">
              {u.employee.employee_no} ·{" "}
              {t(`devices.matched.${u.matched_by || "manual"}`)}
            </span>
          </span>
        ) : (
          <Pill tone="amber">{t("devices.unmapped")}</Pill>
        ),
    },
    {
      id: "actions",
      header: <span className="sr-only">{t("common.actions")}</span>,
      cell: (u) => (
        <Button
          size="sm"
          variant="outline"
          icon={<Link2 className="size-4" />}
          onClick={() => setLinking(u)}
        >
          {u.employee
            ? t("devices.relink")
            : t("devices.link", { id: u.external_id })}
        </Button>
      ),
    },
  ];
  const total = list.data?.count ?? 0;
  return (
    <Card
      variant="solid"
      title={t("devices.users")}
      subtitle={t("devices.usersHint")}
      action={
        <Button size="sm" variant="outline" icon={<FileSpreadsheet className="size-4" />} onClick={() => navigate("/attendance/import-people")}>
          {t("devices.importPeople")}
        </Button>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-4">
        <TextField
          className="min-w-64"
          label={t("devices.findUser")}
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <CheckField
          className="self-end pb-3"
          label={t("devices.onlyUnmapped")}
          checked={unmapped}
          onChange={(e) => {
            setUnmapped(e.target.checked);
            setPage(1);
          }}
        />
      </div>
      <DataTable
        caption={t("devices.users")}
        columns={columns}
        rows={list.data?.results ?? []}
        rowKey={(u) => String(u.id)}
        loading={list.isPending}
        empty={unmapped ? t("devices.allMapped") : t("devices.noUsers")}
        minWidth={860}
      />
      {total > 25 && (
        <Pagination
          page={page}
          pageCount={Math.ceil(total / 25)}
          onPageChange={setPage}
        />
      )}
      {linking && (
        <LinkDialog person={linking} onClose={() => setLinking(null)} />
      )}
    </Card>
  );
}

function EmployeePicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const [search, setSearch] = useState("");
  const found = useQuery({
    queryKey: ["devices", "people", search, ...scope],
    queryFn: () => hr.searchEmployees(search),
    placeholderData: (previous) => previous,
  });
  return (
    <>
      <TextField
        label={t("workflow.preview.findEmployee")}
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <FormSelect
        label={label}
        name="employee"
        value={value}
        placeholder={t("common.choose")}
        options={(found.data?.results ?? []).map((e) => ({
          value: String(e.id),
          label: `${format.name(e)} · ${e.employee_no}`,
        }))}
        onChange={(e) => onChange(e.target.value)}
      />
    </>
  );
}

function LinkDialog({
  person,
  onClose,
}: {
  person: DeviceUser;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [employee, setEmployee] = useState(
    person.employee ? String(person.employee.id) : "",
  );
  const done = async () => {
    await Promise.all(
      ["device-users", "connectors", "punches"].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
    onClose();
  };
  const save = useMutation({
    mutationFn: (id: number | null) => punches.linkUser(person.id, id),
    onSuccess: done,
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("devices.linkTitle", { id: person.external_id })}
      footer={
        <>
          {person.employee && (
            <Button
              variant="outline"
              className="me-auto"
              disabled={save.isPending}
              onClick={() => save.mutate(null)}
            >
              {t("devices.unlink")}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={!employee || save.isPending}
            onClick={() => save.mutate(Number(employee))}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          {t("devices.linkHint", { count: person.punches })}
        </p>
        <EmployeePicker
          label={t("devices.employee")}
          value={employee}
          onChange={setEmployee}
        />
        {(errors.general || errors.fields.employee) && (
          <Alert>{errors.general ?? errors.fields.employee}</Alert>
        )}
      </div>
    </Dialog>
  );
}

function PunchesCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const { can } = useSession();
  const time = usePunchTime();
  const [page, setPage] = useState(1);
  const [source, setSource] = useState("");
  const [entering, setEntering] = useState(false);
  const [selfie, setSelfie] = useState<Punch | null>(null);
  const list = useQuery({
    queryKey: ["punches", source, page, ...scope],
    queryFn: () => punches.list({ source: source || undefined, page }),
    placeholderData: keepPreviousData,
  });
  const columns: Column<Punch>[] = [
    {
      id: "time",
      header: t("devices.time"),
      cell: (p) => <span className="num">{time(p)}</span>,
    },
    {
      id: "who",
      header: t("devices.employee"),
      cell: (p) =>
        p.employee ? (
          <span className="flex flex-col">
            <span className="font-medium text-ink">
              {format.name(p.employee)}
            </span>
            <span className="num text-xs text-muted">
              {p.employee.employee_no}
            </span>
          </span>
        ) : (
          <Pill tone="amber">{t("devices.unmapped")}</Pill>
        ),
    },
    {
      id: "kind",
      header: t("devices.kind"),
      cell: (p) => t(`devices.punchKinds.${p.kind}`),
    },
    {
      id: "source",
      header: t("devices.source"),
      cell: (p) => (
        <span className="flex flex-col">
          <span>{t(`devices.sources.${p.source}`)}</span>
          <span className="text-xs text-muted">
            {p.terminal || p.connector || p.entered_by || ""}
          </span>
        </span>
      ),
    },
    {
      id: "notes",
      header: <span className="sr-only">{t("devices.notes")}</span>,
      cell: (p) => (
        <span className="flex flex-wrap items-center gap-2">
          {p.duplicate_of && <Pill tone="neutral">{t("devices.repeat")}</Pill>}
          {p.location?.outside && <Pill tone="sky">{t(`devices.outside.${p.location.outside}`)}</Pill>}
          {p.location?.mock && (
            <span title={t("devices.mockLocationHint")}>
              <Pill tone="pink">{t("devices.mockLocation")}</Pill>
            </span>
          )}
          {p.location?.distance_m !== null && p.location?.distance_m !== undefined && (
            <span className="num text-xs text-muted">{t("devices.distance", { metres: p.location.distance_m })}</span>
          )}
          {p.has_selfie && can("attendance.manage") && (
            <IconButton size="xs" variant="plain" label={t("devices.selfie")} icon={<Camera />} onClick={() => setSelfie(p)} />
          )}
          {p.note && <span className="text-sm text-muted">{p.note}</span>}
        </span>
      ),
    },
  ];
  const total = list.data?.count ?? 0;
  return (
    <Card
      variant="solid"
      title={t("devices.punches")}
      subtitle={t("devices.punchesHint")}
      action={
        can("attendance.manage") && (
          <Button
            size="sm"
            variant="accent"
            icon={<Plus className="size-4" />}
            onClick={() => setEntering(true)}
          >
            {t("devices.enter")}
          </Button>
        )
      }
    >
      <FormSelect
        className="mb-3 max-w-xs"
        label={t("devices.source")}
        name="source"
        value={source}
        placeholder={t("devices.everySource")}
        onChange={(e) => {
          setSource(e.target.value);
          setPage(1);
        }}
        options={(
          [
            "biotime",
            "biostar",
            "web",
            "mobile",
            "manual",
            "correction",
          ] as const
        ).map((s) => ({ value: s, label: t(`devices.sources.${s}`) }))}
      />
      <DataTable
        caption={t("devices.punches")}
        columns={columns}
        rows={list.data?.results ?? []}
        rowKey={(p) => String(p.id)}
        loading={list.isPending}
        empty={t("devices.noPunches")}
        minWidth={760}
      />
      {total > 25 && (
        <Pagination
          page={page}
          pageCount={Math.ceil(total / 25)}
          onPageChange={setPage}
        />
      )}
      {entering && <EnterDialog onClose={() => setEntering(false)} />}
      {selfie && <SelfieDialog punch={selfie} onClose={() => setSelfie(null)} />}
    </Card>
  );
}

/** HR enters a punch by hand, with the reason. From the "today" tab it comes set to the employee and the day. */
export function EnterDialog({ onClose, person, day }: { onClose: () => void; person?: { id: number; label: string }; day?: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [v, setV] = useState({
    employee: person ? String(person.id) : "",
    time: day ? `${day}T` : "",
    kind: "in" as PunchKind,
    note: "",
  });
  const save = useMutation({
    mutationFn: () => punches.enter({ ...v, employee: Number(v.employee) }),
    onSuccess: async () => {
      await Promise.all(["punches", "attendance-board", "attendance-days"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("devices.enter")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={
              !v.employee || !v.time || !v.note.trim() || save.isPending
            }
            onClick={() => save.mutate()}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t("devices.enterHint")}</p>
        {person ? (
          <p className="font-semibold text-ink">{person.label}</p>
        ) : (
          <EmployeePicker
            label={t("devices.employee")}
            value={v.employee}
            onChange={(employee) => setV({ ...v, employee })}
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t("devices.localTime")}
            name="time"
            type="datetime-local"
            dir="ltr"
            value={v.time}
            onChange={(e) => setV({ ...v, time: e.target.value })}
            error={errors.fields.time}
            required
          />
          <FormSelect
            label={t("devices.kind")}
            name="kind"
            value={v.kind}
            onChange={(e) => setV({ ...v, kind: e.target.value as PunchKind })}
            options={KINDS.map((k) => ({
              value: k,
              label: t(`devices.punchKinds.${k}`),
            }))}
          />
        </div>
        <TextArea
          label={t("devices.reason")}
          name="note"
          rows={2}
          value={v.note}
          onChange={(e) => setV({ ...v, note: e.target.value })}
          error={errors.fields.note}
          required
        />
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

/** A punch's selfie (task 8), through a short-lived signed link; HR only (attendance.manage). */
function SelfieDialog({ punch, onClose }: { punch: Punch; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const time = usePunchTime();
  const link = useQuery({ queryKey: ["punch-selfie", punch.id], queryFn: () => punches.selfie(punch.id), staleTime: 60_000 });
  return (
    <Dialog open onClose={onClose} title={t("devices.selfieOf", { name: punch.employee ? format.name(punch.employee) : "", time: time(punch) })}>
      {link.isError && <Alert>{t("common.loadFailed")}</Alert>}
      {link.data && <img src={`${link.data.url}?inline=1`} alt={t("devices.selfie")} className="mx-auto max-h-96 rounded-card" />}
    </Dialog>
  );
}

/** "Test connection" (task 9): logs in to the server and shows what it has — nothing is stored. */
function TestDialog({ connector, onClose }: { connector: Connector; onClose: () => void }) {
  const { t } = useTranslation();
  const test = useQuery({ queryKey: ["connector-test", connector.id], queryFn: () => punches.test(connector.id), gcTime: 0, retry: false });
  const r = test.data;
  return (
    <Dialog open onClose={onClose} title={t("devices.testOf", { name: connector.name })} footer={<Button onClick={onClose}>{t("common.close")}</Button>}>
      {test.isPending && <p className="text-muted">{t("devices.testing")}</p>}
      {test.isError && <Alert>{t("common.loadFailed")}</Alert>}
      {r && !r.ok && <Alert>{r.error}</Alert>}
      {r?.ok && (
        <div className="flex flex-col gap-3 text-sm">
          <Alert tone="info">{t("devices.testOk", { login: r.found.login })}</Alert>
          <p>{t("devices.testCounts", { terminals: r.found.terminals.length, people: r.found.people, punches: r.found.punches })}</p>
          {r.found.event_codes && (
            <p>
              {t("devices.loggedCodes")}{" "}
              <span dir="ltr" className="num">
                {r.found.event_codes.join(", ") || "—"}
              </span>
            </p>
          )}
          {r.found.terminals.length > 0 && (
            <ul aria-label={t("devices.terminals")} className="flex flex-col gap-1">
              {r.found.terminals.map((x) => (
                <li key={x.serial} className="flex justify-between gap-3">
                  <span className="text-ink">{x.name || x.serial}</span>
                  <span dir="ltr" className="num text-muted">
                    {x.serial}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {r.found.samples.length > 0 && (
            <>
              <p className="font-semibold text-ink">{t("devices.samples")}</p>
              <ul className="flex flex-col gap-1">
                {r.found.samples.map((x) => (
                  <li key={x.event_id} className="flex justify-between gap-3">
                    <span>
                      {x.name || x.user_id} · {t(`devices.punchKinds.${x.kind}`)}
                    </span>
                    <span dir="ltr" className="num text-muted">
                      {x.time}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </Dialog>
  );
}

/** The connector's last reads (task 9; the full sync log is task 12). */
function RunsDialog({ connector, onClose }: { connector: Connector; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const runs = useQuery({ queryKey: ["connector-runs", connector.id], queryFn: () => punches.runs(connector.id) });
  return (
    <Dialog open size="lg" onClose={onClose} title={t("devices.runsOf", { name: connector.name })} footer={<Button onClick={onClose}>{t("common.close")}</Button>}>
      <ol aria-label={t("devices.runsOf", { name: connector.name })} className="flex flex-col divide-y divide-line text-sm">
        {(runs.data ?? []).map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 py-2">
            <Pill tone={r.status === "failed" ? "salmon" : r.status === "running" ? "amber" : "green"}>{t(`devices.runStates.${r.status}`)}</Pill>
            <span className="text-muted">{t(`devices.triggers.${r.trigger}`)}</span>
            <span className="num">{format.relative(r.started_at)}</span>
            <span className="num text-muted">{t("devices.runCounts", { received: r.received, new: r.new, already: r.already, unmapped: r.unmapped })}</span>
            {r.message && <span className="basis-full text-danger">{r.message}</span>}
          </li>
        ))}
      </ol>
      {runs.isSuccess && runs.data.length === 0 && <p className="text-muted">{t("devices.noRuns")}</p>}
    </Dialog>
  );
}

/** Each terminal's last punch on a connection (task 12): a quiet terminal shows here, it isn't alerted (nights,
 * weekends). */
function TerminalsDialog({ connector, onClose }: { connector: Connector; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const list = useQuery({ queryKey: ["connector-terminals", connector.id], queryFn: () => punches.terminals(connector.id) });
  return (
    <Dialog open onClose={onClose} title={t("devices.terminalsOf", { name: connector.name })} footer={<Button onClick={onClose}>{t("common.close")}</Button>}>
      {list.isSuccess && list.data.length === 0 && <p className="text-muted">{t("devices.noTerminals")}</p>}
      <ul aria-label={t("devices.terminalsOf", { name: connector.name })} className="flex flex-col divide-y divide-line text-sm">
        {(list.data ?? []).map((x) => (
          <li key={x.terminal} className="flex flex-wrap items-center justify-between gap-3 py-2">
            <span className="font-medium text-ink">{x.terminal}</span>
            <span className="text-muted">{t("devices.terminalLast", { ago: format.relative(x.last_punch_at), count: x.week })}</span>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
