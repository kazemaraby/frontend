import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { hr } from "@/api/hr";
import { endpoints } from "@/api/index";
import { hireApi, type HireValues, type Offer, type OfferBody, type OfferPreview, type OfferResponse, offersApi } from "@/api/recruitment";
import { useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { DateInput } from "@/design/DateInput";
import { Dialog } from "@/design/Dialog";
import { CheckField, FormSelect, TextArea, TextField } from "@/design/Field";
import { Money } from "@/design/Money";
import { Pill, type PillTone, StatusChip } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

export const RESPONSE_TONES: Record<Exclude<OfferResponse, "">, PillTone> = { waiting: "amber", accepted: "green", declined: "salmon", expired: "neutral", withdrawn: "neutral" };

/** The offers of one application (#118): make one (recruitment.make_offer), its approval and the candidate's answer,
 * the letter, a new link, withdrawal. */
export function ApplicationOffers({ applicationId, stage }: { applicationId: number; stage: string }) {
  const { t } = useTranslation();
  const format = useFormat();
  const { can } = useSession();
  const queryClient = useQueryClient();
  const makes = can("recruitment.make_offer");
  const [making, setMaking] = useState(false);
  const [withdrawing, setWithdrawing] = useState<Offer | null>(null);
  const [hiring, setHiring] = useState<Offer | null>(null);
  const list = useQuery({ queryKey: ["offers", applicationId], queryFn: () => offersApi.list(applicationId) });
  const rows = list.data?.results ?? [];
  const open = rows.some((o) => (o.status === "pending" || o.status === "approved") && (o.response === "" || o.response === "waiting" || o.response === "accepted"));
  const letter = useMutation({ mutationFn: (id: number) => offersApi.letter(id), onSuccess: (link) => window.open(`${link.url}?inline=1`, "_blank", "noopener") });
  const resend = useMutation({ mutationFn: (id: number) => offersApi.resend(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["offers"] }) });
  const closed = ["rejected", "withdrawn", "hired"].includes(stage);
  return (
    <section aria-label={t("recruitment.offers.title")} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{t("recruitment.offers.title")}</h3>
        {makes && !closed && !open && (
          <Button size="sm" variant="outline" icon={<Send className="size-4" />} iconPosition="start" onClick={() => setMaking(true)}>
            {t("recruitment.offers.make")}
          </Button>
        )}
      </div>
      {rows.length === 0 && <p className="text-sm text-muted">{t("recruitment.offers.none")}</p>}
      {rows.map((o) => (
        <div key={o.id} className="flex flex-col gap-2 rounded-card bg-neutral-soft p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{o.reference || t("recruitment.offers.draft")}</span>
            <StatusChip status={o.status === "cancelled" ? "rejected" : o.status} label={t(`requestStatus.${o.status}`)} />
            {o.response && <Pill tone={RESPONSE_TONES[o.response]}>{t(`recruitment.offers.responses.${o.response}`)}</Pill>}
            {o.monthly_total && (
              <span className="ms-auto font-semibold">
                <Money amount={o.monthly_total} currency={o.currency} />
              </span>
            )}
          </div>
          <span className="num text-muted">
            {t("recruitment.offers.startOn", { date: format.date(o.start_date) })} · {t("recruitment.offers.answerBy", { date: format.date(o.valid_until) })}
            {o.decline_reason && ` · ${o.decline_reason}`}
          </span>
          {can("recruitment.hire") && o.response === "accepted" && stage === "offer" && (
            <Button size="sm" variant="accent" className="self-start" onClick={() => setHiring(o)}>
              {t("recruitment.hire.button")}
            </Button>
          )}
          {makes && o.status === "approved" && (
            <span className="flex flex-wrap gap-2">
              {o.has_letter && (
                <Button size="sm" variant="outline" icon={<FileText className="size-4" />} iconPosition="start" disabled={letter.isPending} onClick={() => letter.mutate(o.id)}>
                  {t("recruitment.offers.letter")}
                </Button>
              )}
              {o.response === "waiting" && (
                <>
                  <Button size="sm" variant="ghost" disabled={resend.isPending} onClick={() => resend.mutate(o.id)}>
                    {t("recruitment.offers.resend")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setWithdrawing(o)}>
                    {t("recruitment.offers.withdraw")}
                  </Button>
                </>
              )}
            </span>
          )}
        </div>
      ))}
      {making && <OfferDialog applicationId={applicationId} onClose={() => setMaking(false)} />}
      {withdrawing && <WithdrawDialog offer={withdrawing} onClose={() => setWithdrawing(null)} />}
      {hiring && <HireDialog offer={hiring} onClose={() => setHiring(null)} />}
    </section>
  );
}

function OfferDialog({ applicationId, onClose }: { applicationId: number; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const types = useQuery({ queryKey: ["contract-types"], queryFn: hr.contractTypes });
  const [v, setV] = useState<OfferBody>({ application: applicationId, contract_type: null, contract_months: null, start_date: "", probation_days: 90, basic_salary: "", housing_allowance: "0", transport_allowance: "0", other_allowances: "0", valid_until: "", terms_ar: "", terms_en: "" });
  const [preview, setPreview] = useState<OfferPreview | null>(null);
  const filled = Boolean(v.contract_type && v.start_date && v.basic_salary && v.valid_until);
  useEffect(() => {
    if (!filled) return setPreview(null);
    let live = true;
    const timer = window.setTimeout(() => {
      offersApi
        .preview(v)
        .then((p) => live && setPreview(p))
        .catch(() => live && setPreview(null));
    }, 300);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [v, filled]);
  const save = useMutation({
    mutationFn: () => offersApi.create(v),
    onSuccess: async () => {
      await Promise.all(["offers", "approvals", "requests"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const shown = (name: string) => errors.fields[name] ?? preview?.errors?.[name]?.[0];
  const chosenType = types.data?.results.find((x) => x.id === v.contract_type);
  const money = (name: keyof OfferBody) => ({ name, inputMode: "decimal" as const, dir: "ltr" as const, value: String(v[name] ?? ""), onChange: (e: { target: { value: string } }) => setV({ ...v, [name]: e.target.value }), error: shown(name) });
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={t("recruitment.offers.make")}
      footer={
        <Button variant="accent" disabled={!filled || save.isPending} onClick={() => save.mutate()}>
          {t("recruitment.offers.sendForApproval")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormSelect label={t("recruitment.offers.contractType")} name="contract_type" placeholder={t("common.choose")} value={v.contract_type ?? ""} onChange={(e) => setV({ ...v, contract_type: e.target.value ? Number(e.target.value) : null })} options={(types.data?.results ?? []).map((x) => ({ value: String(x.id), label: format.name(x) }))} error={shown("contract_type")} />
          {chosenType?.has_end_date && <TextField label={t("recruitment.offers.contractMonths")} name="contract_months" type="number" min={1} max={120} dir="ltr" value={v.contract_months ? String(v.contract_months) : ""} onChange={(e) => setV({ ...v, contract_months: Number(e.target.value) || null })} error={shown("contract_months")} />}
          <DateInput label={t("recruitment.offers.startDate")} name="start_date" hijri value={v.start_date || null} onChange={(d) => setV({ ...v, start_date: d ?? "" })} error={shown("start_date")} />
          <TextField label={t("recruitment.offers.probation")} name="probation_days" type="number" min={0} dir="ltr" value={String(v.probation_days)} onChange={(e) => setV({ ...v, probation_days: Number(e.target.value) || 0 })} error={shown("probation_days")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <TextField label={t("recruitment.offers.basic")} {...money("basic_salary")} />
          <TextField label={t("recruitment.offers.housing")} {...money("housing_allowance")} />
          <TextField label={t("recruitment.offers.transport")} {...money("transport_allowance")} />
          <TextField label={t("recruitment.offers.other")} {...money("other_allowances")} />
        </div>
        {preview && preview.lines.length > 0 && (
          <section aria-label={t("recruitment.offers.breakdown")} className="flex flex-col gap-1 rounded-card bg-neutral-soft p-4 text-sm">
            <p className="mb-1 font-semibold">
              {t("recruitment.offers.breakdown")} <span className="text-muted">({preview.structure_name})</span>
            </p>
            {preview.lines.map((ln, i) => (
              <p key={i} className={`flex justify-between ${ln.kind === "deduction" ? "text-danger" : ""}`}>
                <span>{format.name(ln)}</span>
                <Money amount={ln.amount} currency={preview.currency} />
              </p>
            ))}
            {preview.monthly_total && (
              <p className="mt-1 flex justify-between border-t border-line pt-2 font-semibold">
                <span>{t("recruitment.offers.total")}</span>
                <Money amount={preview.monthly_total} currency={preview.currency} />
              </p>
            )}
          </section>
        )}
        <DateInput label={t("recruitment.offers.validUntil")} name="valid_until" value={v.valid_until || null} onChange={(d) => setV({ ...v, valid_until: d ?? "" })} error={shown("valid_until")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextArea label={t("recruitment.offers.termsAr")} name="terms_ar" rows={3} value={v.terms_ar} onChange={(e) => setV({ ...v, terms_ar: e.target.value })} />
          <TextArea label={t("recruitment.offers.termsEn")} name="terms_en" rows={3} dir="ltr" value={v.terms_en} onChange={(e) => setV({ ...v, terms_en: e.target.value })} />
        </div>
        <p className="text-sm text-muted">{t("recruitment.offers.approvalHint")}</p>
        {(errors.fields.detail || errors.general || preview?.errors?.detail) && <Alert>{errors.fields.detail ?? errors.general ?? preview?.errors?.detail?.[0]}</Alert>}
      </div>
    </Dialog>
  );
}

function WithdrawDialog({ offer, onClose }: { offer: Offer; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [tell, setTell] = useState(true);
  const save = useMutation({
    mutationFn: () => offersApi.withdraw(offer.id, reason, tell),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["offers"] });
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      onClose={onClose}
      title={`${t("recruitment.offers.withdraw")} · ${offer.reference}`}
      footer={
        <Button variant="primary" disabled={!reason.trim() || save.isPending} onClick={() => save.mutate()}>
          {t("recruitment.offers.withdraw")}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <TextArea label={t("recruitment.offers.withdrawReason")} name="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} error={errors.fields.reason} />
        <CheckField label={t("recruitment.offers.tellWithdrawn")} checked={tell} onChange={(e) => setTell(e.target.checked)} />
        {(errors.fields.detail || errors.general) && <Alert>{errors.fields.detail ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

const NAME_PARTS = ["first_name", "father_name", "grandfather_name", "family_name"] as const;

/** Hiring an accepted offer (#119): the employee file's fields, started from the candidate's data; with the
 * contract's signing date the person becomes "hired" at once and their onboarding starts. */
export function HireDialog({ offer, onClose }: { offer: Offer; onClose: () => void }) {
  const { t } = useTranslation();
  const form = useQuery({ queryKey: ["hire-form", offer.id], queryFn: () => hireApi.form(offer.id) });
  if (!form.data)
    return (
      <Dialog open onClose={onClose} title={t("recruitment.hire.title")}>
        <p className="text-muted">{form.isError ? t("common.loadFailed") : t("common.loading")}</p>
      </Dialog>
    );
  return <HireForm offer={offer} initial={form.data} onClose={onClose} />;
}

function HireForm({ offer, initial, onClose }: { offer: Offer; initial: HireValues; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [v, setV] = useState<HireValues>(initial);
  const countries = useQuery({ queryKey: ["countries"], queryFn: hr.countries });
  const managers = useQuery({ queryKey: ["employees", "managers"], queryFn: () => endpoints.employees({ status: "active", page_size: 200 }) });
  const save = useMutation({
    mutationFn: () => hireApi.hire(offer.id, v),
    onSuccess: async (done) => {
      await Promise.all(["applications", "application", "offers", "openings", "employees"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      onClose();
      navigate(`/employees/${done.employee}`);
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const text = (name: keyof HireValues, extra: { dir?: "ltr" } = {}) => ({ name, value: String(v[name] ?? ""), onChange: (e: { target: { value: string } }) => setV({ ...v, [name]: e.target.value }), error: errors.fields[name], ...extra });
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={`${t("recruitment.hire.title")} · ${offer.names.candidate}`}
      footer={
        <Button variant="accent" disabled={save.isPending || !(v.first_name_ar || v.first_name_en)} onClick={() => save.mutate()}>
          {t("recruitment.hire.submit")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t("recruitment.hire.intro", { title: format.name(offer.names.job_title), date: format.date(offer.start_date) })}</p>
        {(["ar", "en"] as const).map((lang) => (
          <div key={lang} className="grid gap-3 sm:grid-cols-4">
            {NAME_PARTS.map((part) => (
              <TextField key={part} label={t(`employee.fields.${part}_${lang}`)} {...text(`${part}_${lang}`, lang === "en" ? { dir: "ltr" } : {})} />
            ))}
          </div>
        ))}
        <div className="grid gap-4 sm:grid-cols-3">
          <FormSelect label={t("employee.fields.nationality")} placeholder={t("common.choose")} options={(countries.data ?? []).map((c) => ({ value: c.code, label: format.name(c) }))} {...text("nationality")} />
          <FormSelect label={t("employee.fields.id_type")} placeholder={t("common.choose")} options={(["national_id", "iqama", "border_no"] as const).map((k) => ({ value: k, label: t(`employee.idType.${k}`) }))} {...text("id_type")} />
          <TextField label={t("employee.fields.id_number")} inputMode="numeric" {...text("id_number", { dir: "ltr" })} />
          <FormSelect label={t("employee.fields.gender")} placeholder={t("common.choose")} options={(["male", "female"] as const).map((k) => ({ value: k, label: t(`employee.gender.${k}`) }))} {...text("gender")} />
          <DateInput label={t("employee.fields.date_of_birth")} name="date_of_birth" hijri value={v.date_of_birth} onChange={(d) => setV({ ...v, date_of_birth: d })} error={errors.fields.date_of_birth} />
          <TextField label={t("employee.fields.mobile")} type="tel" {...text("mobile", { dir: "ltr" })} />
          <TextField label={t("employee.fields.personal_email")} type="email" {...text("personal_email", { dir: "ltr" })} />
          <FormSelect label={t("employee.fields.manager")} name="manager" placeholder={t("common.choose")} value={v.manager ? String(v.manager) : ""} onChange={(e) => setV({ ...v, manager: e.target.value ? Number(e.target.value) : null })} options={(managers.data?.results ?? []).map((m) => ({ value: String(m.id), label: `${format.name(m)} (${m.employee_no})` }))} error={errors.fields.manager} />
          <DateInput label={t("recruitment.hire.signedOn")} name="signed_on" value={v.signed_on} onChange={(d) => setV({ ...v, signed_on: d })} hint={t("recruitment.hire.signedOnHint")} error={errors.fields.signed_on} />
        </div>
        {(errors.fields.detail || errors.fields.contract || errors.general) && <Alert>{errors.fields.detail ?? errors.fields.contract ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
