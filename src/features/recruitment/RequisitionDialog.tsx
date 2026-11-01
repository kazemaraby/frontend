import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { hr } from "@/api/hr";
import { endpoints } from "@/api/index";
import { type BudgetResult, type NitaqatEffect, recruitment, type RequisitionBody, type RequisitionPreview } from "@/api/recruitment";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { DateInput } from "@/design/DateInput";
import { Dialog } from "@/design/Dialog";
import { FormSelect, TextArea, TextField } from "@/design/Field";
import { Money } from "@/design/Money";
import { Pill, type PillTone } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

export const BUDGET_TONES: Record<BudgetResult, PillTone> = { within: "green", over: "salmon", none: "neutral" };
export const NITAQAT_TONES: Record<NitaqatEffect, PillTone> = { keeps: "green", drops: "salmon", unknown: "neutral" };

const EMPTY: RequisitionBody = {
  department: null,
  branch: null,
  job_title: null,
  grade: null,
  positions: 1,
  reason: "new",
  replaces: null,
  employment_type: "full_time",
  nationality: "any",
  target_start: "",
  basic_min: "",
  basic_max: "",
  housing: "0",
  justification: "",
};

/** A manpower requisition (Phase 6 task 1, #113, #114). While it is filled in, the budget check and the Nitaqat band
 * before and after the hire show (the server's preview; nothing is saved). With `editId` it corrects that returned
 * requisition and sends it again. */
export function RequisitionDialog({ editId, onClose }: { editId?: number; onClose: () => void }) {
  const { t } = useTranslation();
  const stored = useQuery({ queryKey: ["requisition", editId], queryFn: () => recruitment.requisition(editId!), enabled: Boolean(editId) });
  if (editId && !stored.data)
    return (
      <Dialog open onClose={onClose} title={t("recruitment.newRequisition")}>
        {stored.isError ? <Alert>{apiErrors(stored.error, t("common.loadFailed")).general}</Alert> : <p className="text-muted">{t("common.loading")}</p>}
      </Dialog>
    );
  const s = stored.data;
  const initial: RequisitionBody = s
    ? { department: s.department, branch: s.branch, job_title: s.job_title, grade: s.grade, positions: s.positions, reason: s.reason, replaces: s.replaces, employment_type: s.employment_type, nationality: s.nationality, target_start: s.target_start, basic_min: s.basic_min ?? "", basic_max: s.basic_max ?? "", housing: s.housing ?? "0", justification: s.justification }
    : EMPTY;
  return <RequisitionForm editId={editId} initial={initial} onClose={onClose} />;
}

function RequisitionForm({ editId, initial, onClose }: { editId?: number; initial: RequisitionBody; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const [v, setV] = useState<RequisitionBody>(initial);
  const [preview, setPreview] = useState<RequisitionPreview | null>(null);
  const departments = useQuery({ queryKey: ["departments"], queryFn: endpoints.departments });
  const branches = useQuery({ queryKey: ["branches"], queryFn: hr.branches });
  const titles = useQuery({ queryKey: ["job-titles"], queryFn: hr.jobTitles });
  const grades = useQuery({ queryKey: ["grades"], queryFn: hr.grades });
  const people = useQuery({
    queryKey: ["employees", "department", v.department],
    queryFn: () => endpoints.employees({ department: v.department!, status: "active", page_size: 100 }),
    enabled: v.reason === "replacement" && Boolean(v.department),
  });
  const filled = Boolean(v.department && v.job_title && v.target_start && v.basic_min && v.basic_max);

  useEffect(() => {
    if (!filled) return setPreview(null);
    let live = true;
    const timer = window.setTimeout(() => {
      recruitment
        .preview(v, editId)
        .then((p) => live && setPreview(p))
        .catch(() => live && setPreview(null));
    }, 300);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [v, filled, editId]);

  const save = useMutation({
    mutationFn: async () => {
      if (!editId) return recruitment.createRequisition(v);
      await recruitment.updateRequisition(editId, v);
      return recruitment.resubmitRequisition(editId);
    },
    onSuccess: async () => {
      await Promise.all(["requisitions", "headcount-budgets", "requests", "approvals"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const shown = (name: string) => errors.fields[name] ?? preview?.errors?.[name]?.[0];
  const pickGrade = (raw: string) => {
    const grade = grades.data?.results.find((g) => g.id === Number(raw));
    setV({ ...v, grade: grade?.id ?? null, basic_min: grade?.min_salary ?? v.basic_min, basic_max: grade?.max_salary ?? v.basic_max });
  };
  const options = <T extends { id: number; name_ar: string; name_en: string }>(rows: T[] | undefined) => (rows ?? []).map((r) => ({ value: String(r.id), label: format.name(r) }));
  const id = (raw: string) => (raw ? Number(raw) : null);
  const budget = preview?.budget_detail;
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={editId ? `${t("approvals.editAndResubmit")} · ${t("recruitment.newRequisition")}` : t("recruitment.newRequisition")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="accent" disabled={save.isPending || !filled || !v.justification.trim()} onClick={() => save.mutate()}>
            {t("approvals.send")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormSelect label={t("recruitment.requisition.department")} name="department" placeholder={t("common.choose")} value={v.department ?? ""} onChange={(e) => setV({ ...v, department: id(e.target.value), replaces: null })} options={options(departments.data?.results)} error={shown("department")} />
          <FormSelect label={t("recruitment.requisition.branch")} name="branch" placeholder={t("common.choose")} value={v.branch ?? ""} onChange={(e) => setV({ ...v, branch: id(e.target.value) })} options={options(branches.data?.results)} error={shown("branch")} />
          <FormSelect label={t("recruitment.requisition.jobTitle")} name="job_title" placeholder={t("common.choose")} value={v.job_title ?? ""} onChange={(e) => setV({ ...v, job_title: id(e.target.value) })} options={options(titles.data?.results.filter((x) => x.is_active))} error={shown("job_title")} />
          <FormSelect label={t("recruitment.requisition.grade")} name="grade" placeholder={t("common.choose")} value={v.grade ?? ""} onChange={(e) => pickGrade(e.target.value)} options={options(grades.data?.results.filter((x) => x.is_active))} error={shown("grade")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label={t("recruitment.requisition.positions")} name="positions" type="number" min={1} max={500} value={String(v.positions)} onChange={(e) => setV({ ...v, positions: Math.max(1, Number(e.target.value) || 1) })} error={shown("positions")} />
          <FormSelect label={t("recruitment.requisition.reason")} name="reason" value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value as RequisitionBody["reason"], replaces: null })} options={(["new", "replacement"] as const).map((r) => ({ value: r, label: t(`recruitment.reasons.${r}`) }))} />
          <DateInput label={t("recruitment.requisition.targetStart")} name="target_start" value={v.target_start || null} onChange={(d) => setV({ ...v, target_start: d ?? "" })} error={shown("target_start")} />
        </div>
        {v.reason === "replacement" && (
          <FormSelect
            label={t("recruitment.requisition.replaces")}
            name="replaces"
            placeholder={t("common.choose")}
            value={v.replaces ?? ""}
            onChange={(e) => setV({ ...v, replaces: id(e.target.value) })}
            options={(people.data?.results ?? []).map((p) => ({ value: String(p.id), label: `${format.name(p)} (${p.employee_no})` }))}
            error={shown("replaces")}
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormSelect label={t("recruitment.requisition.employmentType")} name="employment_type" value={v.employment_type} onChange={(e) => setV({ ...v, employment_type: e.target.value as RequisitionBody["employment_type"] })} options={(["full_time", "part_time"] as const).map((k) => ({ value: k, label: t(`recruitment.employmentTypes.${k}`) }))} />
          <FormSelect label={t("recruitment.requisition.nationality")} name="nationality" value={v.nationality} onChange={(e) => setV({ ...v, nationality: e.target.value as RequisitionBody["nationality"] })} options={(["any", "saudi", "non_saudi"] as const).map((k) => ({ value: k, label: t(`recruitment.nationalities.${k}`) }))} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label={t("recruitment.requisition.basicMin")} name="basic_min" inputMode="decimal" dir="ltr" value={v.basic_min} onChange={(e) => setV({ ...v, basic_min: e.target.value })} error={shown("basic_min")} />
          <TextField label={t("recruitment.requisition.basicMax")} name="basic_max" inputMode="decimal" dir="ltr" value={v.basic_max} onChange={(e) => setV({ ...v, basic_max: e.target.value })} error={shown("basic_max")} />
          <TextField label={t("recruitment.requisition.housing")} name="housing" inputMode="decimal" dir="ltr" value={v.housing} onChange={(e) => setV({ ...v, housing: e.target.value })} error={shown("housing")} />
        </div>
        <TextArea label={t("recruitment.requisition.justification")} name="justification" rows={3} value={v.justification} onChange={(e) => setV({ ...v, justification: e.target.value })} error={shown("justification")} />
        {preview && preview.budget && (
          <section aria-label={t("recruitment.preview")} className="flex flex-col gap-3 rounded-card bg-neutral-soft p-4 text-sm">
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{t("recruitment.requisition.budget")}</span>
              <Pill tone={BUDGET_TONES[preview.budget]}>{t(`recruitment.budget.${preview.budget}`)}</Pill>
              {budget && budget.positions != null && (
                <span className="num text-muted">
                  {t("recruitment.budgetLine", { headcount: format.number(budget.headcount ?? 0), committed: format.number(budget.committed ?? 0), asking: format.number(budget.asking ?? 0), positions: format.number(budget.positions) })}
                </span>
              )}
            </p>
            {preview.monthly_cost && (
              <p className="flex flex-wrap items-center gap-x-2">
                {t("recruitment.monthlyCost")} <Money amount={preview.monthly_cost} />
              </p>
            )}
            <div className="flex flex-col gap-1">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{t("recruitment.requisition.nitaqat")}</span>
                {preview.nitaqat && <Pill tone={NITAQAT_TONES[preview.nitaqat]}>{t(`recruitment.nitaqat.${preview.nitaqat}`)}</Pill>}
                {preview.nitaqat_detail.reason && <span className="text-muted">{t(`recruitment.nitaqatReasons.${preview.nitaqat_detail.reason}`)}</span>}
              </p>
              {Object.entries(preview.nitaqat_detail.scenarios ?? {}).map(([name, s]) => (
                <p key={name} className="num text-muted">
                  {t(`recruitment.scenarios.${name}`)}: {t(`nitaqat.bands.${s.before || "none"}`, { defaultValue: "—" })} {format.dir === "rtl" ? "←" : "→"} {t(`nitaqat.bands.${s.after || "none"}`, { defaultValue: "—" })}
                  {s.after_percent && ` (${format.number(s.after_percent, [0, 1])}%)`}
                </p>
              ))}
            </div>
          </section>
        )}
        {(errors.fields.detail || errors.general || preview?.errors?.detail) && <Alert>{errors.fields.detail ?? errors.general ?? preview?.errors?.detail?.[0]}</Alert>}
      </div>
    </Dialog>
  );
}
