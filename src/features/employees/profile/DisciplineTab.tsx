import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { type Employee, holds } from "@/api";
import { type ActionInput, discipline, type DisciplinaryAction, PENALTY_TYPES, type PenaltyType } from "@/api/discipline";
import { type Penalty, penalties } from "@/api/payroll";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { Dialog } from "@/design/Dialog";
import { FormSelect, TextArea, TextField } from "@/design/Field";
import { Pill, type PillTone } from "@/design/Pill";
import { usePenaltyText } from "@/features/payroll/PenaltiesTab";
import { apiErrors } from "@/lib/apiErrors";
import { toISODate } from "@/lib/format";
import { useFormat } from "@/lib/useFormat";

const STATUS_TONES: Record<string, PillTone> = { approved: "salmon", pending: "amber", rejected: "neutral", cancelled: "neutral", returned: "sky" };

/** The employee's disciplinary actions (Phase 4 task 10, #47): filed by HR, decided through approvals. The
 * employee sees their own approved ones. */
export function DisciplineTab({ employee }: { employee: Employee }) {
  const { t } = useTranslation();
  const format = useFormat();
  const { me } = useSession();
  const manage = holds(employee, "employees.manage_discipline");
  const own = me?.employee?.id === employee.id;
  const list = useQuery({ queryKey: ["disciplinary-actions", employee.id, manage], queryFn: () => (manage ? discipline.actions(employee.id) : discipline.mine()), enabled: manage || own });
  const [filing, setFiling] = useState(false);
  const columns: Column<DisciplinaryAction>[] = [
    { id: "date", header: t("discipline.occurredOn"), cell: (a) => <span className="num">{format.date(a.occurred_on)}</span>, className: "w-36" },
    { id: "what", header: t("discipline.description"), cell: (a) => <span className="text-sm">{a.description}</span> },
    { id: "time", header: t("discipline.time"), cell: (a) => <span className="num">{format.number(a.occurrence)}</span>, className: "w-20" },
    { id: "penalty", header: t("discipline.penalty"), cell: (a) => <span className="text-sm">{t(`discipline.types.${a.penalty_type}`)}{a.penalty_value ? ` · ${format.number(a.penalty_value, [0, 2])}` : ""}</span> },
    { id: "status", header: t("discipline.status"), cell: (a) => <Pill tone={STATUS_TONES[a.status] ?? "neutral"}>{t(`discipline.statuses.${a.status}`)}</Pill> },
  ];
  return (
    <Card
      variant="solid"
      title={t("discipline.title")}
      subtitle={t("discipline.hint")}
      action={
        manage && (
          <Button size="sm" variant="accent" icon={<Plus className="size-4" />} onClick={() => setFiling(true)}>
            {t("discipline.file")}
          </Button>
        )
      }
    >
      <DataTable caption={t("discipline.title")} columns={columns} rows={list.data ?? []} rowKey={(a) => String(a.id)} loading={list.isPending} empty={t("discipline.none")} minWidth={760} />
      {filing && <FileActionDialog employee={employee} onClose={() => setFiling(false)} />}
    </Card>
  );
}

type Prefill = { attendanceRule?: number; occurredOn?: string; description?: string };

/** Filing a disciplinary action: the violation (attendance table or the violation list), what happened, when the
 * employee was told and their statement (Art. 71), and the penalty — by default the table's for this time. */
export function FileActionDialog({ employee, prefill, onClose }: { employee: Pick<Employee, "id">; prefill?: Prefill; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const queryClient = useQueryClient();
  const text = usePenaltyText();
  const violations = useQuery({ queryKey: ["violations", ...scope], queryFn: discipline.violations });
  const table = useQuery({ queryKey: ["attendance-penalties", ...scope], queryFn: penalties.table });
  const today = toISODate(new Date());
  const [choice, setChoice] = useState(prefill?.attendanceRule ? `a:${prefill.attendanceRule}` : "");
  const [v, setV] = useState<Omit<ActionInput, "employee" | "violation" | "attendance_rule">>({
    occurred_on: prefill?.occurredOn ?? today,
    discovered_on: prefill?.occurredOn ?? today,
    description: prefill?.description ?? "",
    notified_on: today,
    statement: "",
    penalty_type: "warning",
    penalty_value: null,
    suspension_from: null,
  });
  const target = choice.startsWith("a:") ? { attendance_rule: Number(choice.slice(2)), violation: null } : choice ? { violation: Number(choice.slice(2)), attendance_rule: null } : null;
  const proposal = useQuery({
    queryKey: ["discipline-propose", employee.id, choice, v.occurred_on],
    queryFn: () => discipline.propose({ employee: employee.id, occurred_on: v.occurred_on, ...target! }),
    enabled: Boolean(target && v.occurred_on),
  });
  useEffect(() => {
    const p: Penalty | null | undefined = proposal.data?.penalty;
    if (!p) return;
    const type: PenaltyType = p.type === "days_or_hold" ? "days" : (p.type as PenaltyType);
    setV((x) => ({ ...x, penalty_type: type, penalty_value: p.value !== undefined ? String(p.value) : null }));
  }, [proposal.data]);
  const file = useMutation({
    mutationFn: () => discipline.file({ ...v, employee: employee.id, violation: target?.violation ?? null, attendance_rule: target?.attendance_rule ?? null }),
    onSuccess: async () => {
      await Promise.all(["disciplinary-actions", "approvals", "requests"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      onClose();
    },
  });
  const errors = apiErrors(file.error, t("common.saveFailed"));
  const valued = v.penalty_type === "percent" || v.penalty_type === "days" || v.penalty_type === "suspension";
  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={t("discipline.file")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="accent" disabled={!target || !v.description.trim() || file.isPending} onClick={() => file.mutate()}>
            {t("approvals.send")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormSelect
          label={t("discipline.violation")}
          name="violation"
          value={choice}
          placeholder={t("common.choose")}
          onChange={(e) => setChoice(e.target.value)}
          options={[
            ...(table.data?.rows ?? []).map((r) => ({ value: `a:${r.id}`, label: `${t(`penalties.kinds.${r.kind}`)} · ${r.max_value === null ? t("penalties.over", { from: format.number(r.min_value), unit: t(r.kind === "absence" ? "penalties.days" : "penalties.minutes") }) : t("penalties.range", { from: format.number(r.min_value), to: format.number(r.max_value), unit: t(r.kind === "absence" ? "penalties.days" : "penalties.minutes") })}${r.delays_others ? ` (${t("penalties.delaysOthers")})` : ""}` })),
            ...(violations.data ?? []).filter((x) => x.is_active).map((x) => ({ value: `v:${x.id}`, label: format.name(x) })),
          ]}
          error={errors.fields.violation}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("discipline.occurredOn")} name="occurred_on" type="date" value={v.occurred_on} max={today} onChange={(e) => setV({ ...v, occurred_on: e.target.value })} error={errors.fields.occurred_on} />
          <TextField label={t("discipline.discoveredOn")} name="discovered_on" type="date" value={v.discovered_on} max={today} onChange={(e) => setV({ ...v, discovered_on: e.target.value })} error={errors.fields.discovered_on} />
        </div>
        <TextArea label={t("discipline.description")} name="description" rows={2} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} error={errors.fields.description} />
        <fieldset className="flex flex-col gap-3 rounded-card border border-line p-4">
          <legend className="px-1 font-semibold text-ink">{t("discipline.hearing")}</legend>
          <TextField label={t("discipline.notifiedOn")} name="notified_on" type="date" value={v.notified_on ?? ""} max={today} onChange={(e) => setV({ ...v, notified_on: e.target.value || null })} error={errors.fields.notified_on} />
          <TextArea label={t("discipline.statement")} name="statement" rows={2} value={v.statement} onChange={(e) => setV({ ...v, statement: e.target.value })} error={errors.fields.statement} />
        </fieldset>
        {proposal.data?.penalty && (
          <Alert tone="info">{t("discipline.proposed", { n: format.number(proposal.data.occurrence), penalty: text(proposal.data.penalty) })}</Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <FormSelect label={t("discipline.penalty")} name="penalty_type" value={v.penalty_type} onChange={(e) => setV({ ...v, penalty_type: e.target.value as PenaltyType })} options={PENALTY_TYPES.map((x) => ({ value: x, label: t(`discipline.types.${x}`) }))} />
          {valued && <TextField label={t(`discipline.valueOf.${v.penalty_type}`)} name="penalty_value" dir="ltr" inputMode="decimal" value={v.penalty_value ?? ""} onChange={(e) => setV({ ...v, penalty_value: e.target.value || null })} error={errors.fields.penalty_value} />}
          {v.penalty_type === "suspension" && <TextField label={t("discipline.suspensionFrom")} name="suspension_from" type="date" value={v.suspension_from ?? ""} onChange={(e) => setV({ ...v, suspension_from: e.target.value || null })} error={errors.fields.suspension_from} />}
        </div>
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
