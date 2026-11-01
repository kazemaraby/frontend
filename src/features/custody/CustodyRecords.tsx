import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, FileDown, HandCoins, PackageCheck, PackagePlus, PackageX } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { hr } from "@/api/hr";
import { type Custody, custody, type CustodyKind, type CustodyStatus } from "@/api/custody";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { DateInput } from "@/design/DateInput";
import { Dialog } from "@/design/Dialog";
import { FormSelect, TextArea, TextField } from "@/design/Field";
import { FileDrop } from "@/design/FileDrop";
import { Money } from "@/design/Money";
import { Pagination } from "@/design/Pagination";
import { Pill, type PillTone } from "@/design/Pill";
import { Tabs } from "@/design/Tabs";
import { openFile } from "@/features/employees/download";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

const PAGE_SIZE = 25;
const TONES: Record<CustodyStatus, PillTone> = { open: "amber", returned: "green", lost: "salmon" };
const today = () => new Date().toLocaleDateString("en-CA");

type Filter = "open" | "all";

/** Custody records by data scope: one employee's (their file), or every record the user may see (/custody).
 * Holders acknowledge receipt; HR (`manage`) hands over, receives back and records a loss. */
export function CustodyRecords({ employee, manage, title }: { employee?: { id: number; name_ar: string; name_en: string }; manage: boolean; title: string }) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const { me } = useSession();
  const [filter, setFilter] = useState<Filter>("open");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<{ kind: "hand" } | { kind: "return" | "lost"; row: Custody } | null>(null);
  const queryClient = useQueryClient();
  const rows = useQuery({
    queryKey: ["custody", "records", employee?.id ?? "all", filter, page, ...scope],
    queryFn: () => custody.list({ employee: employee?.id, status: filter === "open" ? "open" : undefined, page }),
    placeholderData: (previous) => previous,
  });
  const acknowledge = useMutation({
    mutationFn: (id: number) => custody.acknowledge(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["custody"] }),
  });

  const columns: Column<Custody>[] = [
    ...(employee
      ? []
      : [
          {
            id: "employee",
            header: t("custody.employee"),
            cell: (c: Custody) => (
              <span className="flex flex-col">
                <span className="font-semibold text-ink">{format.name(c.employee)}</span>
                <span className="num text-sm text-muted">{c.employee.employee_no}</span>
              </span>
            ),
          },
        ]),
    {
      id: "what",
      header: t("custody.what"),
      cell: (c) => (
        <span className="flex flex-col items-start gap-1">
          <span className="font-medium text-ink">{c.kind === "cash" ? c.description || t("custody.kinds.cash") : format.pick(c.label)}</span>
          <span className="flex flex-wrap items-center gap-2 text-sm text-muted">
            {c.kind === "cash" ? t("custody.kinds.cash") : t(`custody.categories.${c.category ?? "other"}`)}
            {c.amount && <Money amount={c.amount} />}
          </span>
        </span>
      ),
    },
    {
      id: "handed",
      header: t("custody.handedOn"),
      cell: (c) => (
        <span className="flex flex-col">
          <span className="num text-muted">{format.date(c.handed_on)}</span>
          {c.due_on && c.status === "open" && <span className="num text-sm text-muted">{t("custody.dueOn", { day: format.date(c.due_on) })}</span>}
        </span>
      ),
    },
    {
      id: "status",
      header: t("approvals.columns.status"),
      cell: (c) => (
        <span className="flex flex-col items-start gap-1">
          <Pill tone={TONES[c.status]}>{t(`custody.status.${c.status}`)}</Pill>
          {c.status === "open" && !c.acknowledged_at && <span className="text-sm text-amber-800">{t("custody.notAcknowledged")}</span>}
          {c.status !== "open" && c.returned_on && <span className="num text-sm text-muted">{format.date(c.returned_on)}</span>}
          {Number(c.shortfall) > 0 && (
            <span className="text-sm text-danger">
              {t("custody.shortfall")} <Money amount={c.shortfall} />
            </span>
          )}
        </span>
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">{t("common.actions")}</span>,
      cell: (c) => {
        const what = format.pick(c.label);
        const mine = me?.employee?.id === c.employee.id;
        return (
          <span className="flex flex-wrap justify-end gap-1">
            {mine && c.status === "open" && !c.acknowledged_at && (
              <Button size="sm" variant="accent" icon={<CircleCheck className="size-4" />} disabled={acknowledge.isPending} onClick={() => acknowledge.mutate(c.id)}>
                {t("custody.acknowledge")}
              </Button>
            )}
            {c.has_file && <IconButton size="sm" variant="plain" label={t("custody.handoverFile", { what })} icon={<FileDown />} onClick={() => void openFile(() => custody.link(c.id, "handover"))} />}
            {c.has_return_file && <IconButton size="sm" variant="plain" label={t("custody.returnFile", { what })} icon={<FileDown />} onClick={() => void openFile(() => custody.link(c.id, "return"))} />}
            {manage && c.status === "open" && (
              <>
                <IconButton size="sm" variant="plain" label={t("custody.receiveNamed", { what })} icon={<PackageCheck />} onClick={() => setDialog({ kind: "return", row: c })} />
                <IconButton size="sm" variant="plain" label={t("custody.lostNamed", { what })} icon={<PackageX />} onClick={() => setDialog({ kind: "lost", row: c })} />
              </>
            )}
          </span>
        );
      },
    },
  ];
  const total = rows.data?.count ?? 0;
  return (
    <Card
      variant="solid"
      title={title}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            variant="segmented"
            label={t("custody.filter")}
            value={filter}
            onChange={(next) => {
              setFilter(next);
              setPage(1);
            }}
            items={(["open", "all"] as const).map((id) => ({ id, label: t(`custody.filters.${id}`) }))}
          />
          {manage && (
            <Button size="sm" variant="accent" icon={<PackagePlus className="size-4" />} onClick={() => setDialog({ kind: "hand" })}>
              {t("custody.handOver")}
            </Button>
          )}
        </div>
      }
    >
      {acknowledge.error && <Alert className="mb-3">{apiErrors(acknowledge.error, t("common.saveFailed")).general ?? apiErrors(acknowledge.error, "").fields.detail}</Alert>}
      <DataTable caption={title} columns={columns} rows={rows.data?.results ?? []} rowKey={(c) => String(c.id)} loading={rows.isPending} empty={t(filter === "open" ? "custody.noneOpen" : "custody.none")} minWidth={employee ? 640 : 820} />
      {total > PAGE_SIZE && <Pagination page={page} pageCount={Math.ceil(total / PAGE_SIZE)} onPageChange={setPage} />}
      {dialog?.kind === "hand" && <HandOverDialog employee={employee} onClose={() => setDialog(null)} />}
      {dialog?.kind === "return" && <ReturnDialog row={dialog.row} onClose={() => setDialog(null)} />}
      {dialog?.kind === "lost" && <LostDialog row={dialog.row} onClose={() => setDialog(null)} />}
    </Card>
  );
}

function useDone(onClose: () => void) {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: ["custody"] });
    onClose();
  };
}

function HandOverDialog({ employee, onClose }: { employee?: { id: number; name_ar: string; name_en: string }; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const done = useDone(onClose);
  const [search, setSearch] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [v, setV] = useState({ employee: employee ? String(employee.id) : "", kind: "asset" as CustodyKind, item: "", description: "", amount: "", handed_on: today(), due_on: "", condition_out: "" });
  const set = <K extends keyof typeof v>(key: K, value: (typeof v)[K]) => setV((x) => ({ ...x, [key]: value }));
  const employees = useQuery({ queryKey: ["custody", "employees", search, ...scope], queryFn: () => hr.searchEmployees(search), enabled: !employee, placeholderData: (previous) => previous });
  const items = useQuery({ queryKey: ["custody", "items", "available", ...scope], queryFn: () => custody.items({ status: "available", page_size: 200 }), enabled: v.kind === "asset" });
  const save = useMutation({
    mutationFn: () =>
      custody.handOver({
        employee: Number(v.employee),
        kind: v.kind,
        item: v.kind === "asset" ? v.item : "",
        description: v.description,
        amount: v.amount,
        handed_on: v.handed_on,
        due_on: v.due_on,
        condition_out: v.condition_out,
        ...(file ? { file } : {}),
      }),
    onSuccess: done,
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const ready = v.employee && v.handed_on && (v.kind === "cash" ? v.amount.trim() : v.item || v.description.trim());
  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={employee ? t("custody.handOverTo", { name: format.name(employee) }) : t("custody.handOver")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!ready || save.isPending} onClick={() => save.mutate()}>
            {t("custody.handOverNow")}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {!employee && (
          <>
            <TextField label={t("workflow.preview.findEmployee")} type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
            <FormSelect
              label={t("custody.employee")}
              name="employee"
              value={v.employee}
              placeholder={t("common.choose")}
              options={(employees.data?.results ?? []).map((e) => ({ value: String(e.id), label: `${format.name(e)} · ${e.employee_no}` }))}
              onChange={(e) => set("employee", e.target.value)}
              error={errors.fields.employee}
            />
          </>
        )}
        <FormSelect label={t("custody.kind")} name="kind" value={v.kind} onChange={(e) => set("kind", e.target.value as CustodyKind)} options={(["asset", "cash"] as const).map((k) => ({ value: k, label: t(`custody.kinds.${k}`) }))} />
        {v.kind === "asset" ? (
          <FormSelect
            label={t("custody.item")}
            name="item"
            value={v.item}
            placeholder={t("custody.notInRegister")}
            options={(items.data?.results ?? []).map((i) => ({ value: String(i.id), label: `${format.name(i)}${i.asset_tag ? ` · ${i.asset_tag}` : ""}` }))}
            onChange={(e) => set("item", e.target.value)}
            error={errors.fields.item}
          />
        ) : (
          <TextField label={t("custody.amount")} name="amount" inputMode="decimal" dir="ltr" value={v.amount} onChange={(e) => set("amount", e.target.value)} error={errors.fields.amount} required />
        )}
        <TextField
          label={v.kind === "cash" ? t("custody.purpose") : t("custody.description")}
          name="description"
          className="sm:col-span-2"
          value={v.description}
          onChange={(e) => set("description", e.target.value)}
          hint={v.kind === "asset" && !v.item ? t("custody.descriptionHint") : undefined}
          error={errors.fields.description}
        />
        <DateInput label={t("custody.handedOn")} name="handed_on" value={v.handed_on || null} max={today()} onChange={(d) => set("handed_on", d ?? "")} error={errors.fields.handed_on} required />
        <DateInput label={t("custody.due")} name="due_on" value={v.due_on || null} min={v.handed_on || undefined} onChange={(d) => set("due_on", d ?? "")} error={errors.fields.due_on} />
        <TextField label={t("custody.conditionOut")} name="condition_out" className="sm:col-span-2" value={v.condition_out} onChange={(e) => set("condition_out", e.target.value)} />
        <FileDrop className="sm:col-span-2" label={t("custody.receipt")} file={file} onChange={setFile} limits={t("custody.receiptHint")} error={errors.fields.file} />
        {(errors.general || errors.fields.detail) && <Alert className="sm:col-span-2">{errors.general ?? errors.fields.detail}</Alert>}
      </div>
    </Dialog>
  );
}

function ReturnDialog({ row, onClose }: { row: Custody; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const done = useDone(onClose);
  const cash = row.kind === "cash";
  const [file, setFile] = useState<File | null>(null);
  const [v, setV] = useState({ returned_on: today(), condition_in: "good", returned_amount: "", spent_amount: "", return_notes: "" });
  const set = <K extends keyof typeof v>(key: K, value: (typeof v)[K]) => setV((x) => ({ ...x, [key]: value }));
  const save = useMutation({
    mutationFn: () => custody.receive(row.id, { ...v, ...(cash ? { condition_in: undefined } : { returned_amount: undefined, spent_amount: undefined }), ...(file ? { file } : {}) }),
    onSuccess: done,
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  // Whole halalas, so the hint never shows float noise; the backend computes the stored shortfall.
  const halalas = (x: string | null | undefined) => Math.round(Number(x || 0) * 100) || 0;
  const short = cash ? halalas(row.amount) - halalas(v.returned_amount) - halalas(v.spent_amount) : 0;
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("custody.receiveNamed", { what: format.pick(row.label) })}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!v.returned_on || save.isPending} onClick={() => save.mutate()}>
            {t("custody.receive")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <DateInput label={t("custody.returnedOn")} name="returned_on" value={v.returned_on || null} min={row.handed_on} max={today()} onChange={(d) => set("returned_on", d ?? "")} error={errors.fields.returned_on} required />
        {cash ? (
          <>
            <p className="text-sm text-muted">
              {t("custody.cashHanded")} <Money amount={row.amount ?? "0"} />
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label={t("custody.returnedAmount")} name="returned_amount" inputMode="decimal" dir="ltr" value={v.returned_amount} onChange={(e) => set("returned_amount", e.target.value)} error={errors.fields.returned_amount} />
              <TextField label={t("custody.spentAmount")} name="spent_amount" inputMode="decimal" dir="ltr" value={v.spent_amount} onChange={(e) => set("spent_amount", e.target.value)} />
            </div>
            {short > 0 && (
              <p role="status" className="rounded-card bg-danger-soft px-4 py-3 text-sm text-danger">
                {t("custody.shortfallHint")} <Money amount={(short / 100).toFixed(2)} />
              </p>
            )}
          </>
        ) : (
          <FormSelect label={t("custody.conditionIn")} name="condition_in" value={v.condition_in} onChange={(e) => set("condition_in", e.target.value)} options={(["good", "damaged"] as const).map((c) => ({ value: c, label: t(`custody.conditions.${c}`) }))} hint={v.condition_in === "damaged" ? t("custody.damagedHint") : undefined} />
        )}
        <TextArea label={t("custody.returnNotes")} name="return_notes" rows={2} value={v.return_notes} onChange={(e) => set("return_notes", e.target.value)} />
        <FileDrop label={cash ? t("custody.receipts") : t("custody.returnReceipt")} file={file} onChange={setFile} error={errors.fields.file} />
        {(errors.general || errors.fields.detail) && <Alert>{errors.general ?? errors.fields.detail}</Alert>}
      </div>
    </Dialog>
  );
}

function LostDialog({ row, onClose }: { row: Custody; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const done = useDone(onClose);
  const [v, setV] = useState({ returned_on: today(), return_notes: "", shortfall: row.amount ?? "" });
  const set = <K extends keyof typeof v>(key: K, value: (typeof v)[K]) => setV((x) => ({ ...x, [key]: value }));
  const save = useMutation({ mutationFn: () => custody.lost(row.id, v), onSuccess: done });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("custody.lostNamed", { what: format.pick(row.label) })}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!v.return_notes.trim() || save.isPending} onClick={() => save.mutate()}>
            {t("custody.markLost")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t("custody.lostHint")}</p>
        <DateInput label={t("custody.lostOn")} name="returned_on" value={v.returned_on || null} min={row.handed_on} max={today()} onChange={(d) => set("returned_on", d ?? "")} error={errors.fields.returned_on} required />
        <TextField label={t("custody.owed")} name="shortfall" inputMode="decimal" dir="ltr" value={v.shortfall} onChange={(e) => set("shortfall", e.target.value)} hint={t("custody.owedHint")} error={errors.fields.shortfall} />
        <TextArea label={t("custody.whatHappened")} name="return_notes" rows={2} value={v.return_notes} onChange={(e) => set("return_notes", e.target.value)} error={errors.fields.return_notes} required />
        {(errors.general || errors.fields.detail) && <Alert>{errors.general ?? errors.fields.detail}</Alert>}
      </div>
    </Dialog>
  );
}

/** What an employee still holds and owes (the clearance in Phase 4 reads the same numbers). */
export function OutstandingTiles({ employee }: { employee: number }) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const data = useQuery({ queryKey: ["custody", "outstanding", employee, ...scope], queryFn: () => custody.outstanding(employee) });
  if (!data.data) return null;
  const tiles = [
    { key: "open", value: <span className="num">{format.number(data.data.open)}</span> },
    { key: "openCash", value: <Money amount={data.data.open_cash} /> },
    { key: "owed", value: <Money amount={data.data.shortfall} /> },
  ];
  return (
    <ul aria-label={t("custody.summary")} className="grid gap-3 sm:grid-cols-3">
      {tiles.map((tile) => (
        <li key={tile.key} className="rounded-panel bg-white p-5 shadow-soft">
          <p className="flex items-center gap-2 text-sm text-muted">
            {tile.key === "owed" && <HandCoins aria-hidden="true" className="size-4" />}
            {t(`custody.tiles.${tile.key}`)}
          </p>
          <p className="mt-2 text-2xl font-semibold text-ink">{tile.value}</p>
        </li>
      ))}
    </ul>
  );
}
