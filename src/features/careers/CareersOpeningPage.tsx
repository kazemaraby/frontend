import { useMutation, useQuery } from "@tanstack/react-query";
import { CircleCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";

import { ApiError } from "@/api";
import { type CareerOpening, careersApi } from "@/api/recruitment";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { CheckField, FormSelect, TextArea, TextField } from "@/design/Field";
import { FileDrop } from "@/design/FileDrop";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

import { CareersFrame } from "./CareersPage";

/** /careers/:id — public: a job's texts and the application form (CV, screening questions, the privacy notice to
 * agree to, an optional talent-pool consent, and Cloudflare Turnstile when the server has a site key). */
export default function CareersOpeningPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const job = useQuery({ queryKey: ["careers", id], queryFn: () => careersApi.opening(id), retry: false });
  const gone = job.error instanceof ApiError && job.error.status === 404;
  return (
    <CareersFrame title={job.data?.title_ar ?? t("careers.openJobs")}>
      {job.isPending ? (
        <p className="text-muted">{t("common.loading")}</p>
      ) : !job.data ? (
        <section className="rounded-panel bg-white/70 p-6 shadow-soft">
          <p role="alert" className="font-semibold text-ink">{gone ? t("careers.closed") : t("careers.unavailable")}</p>
          <Link to="/careers" className="mt-3 inline-block text-teal-dark hover:underline">
            {t("careers.allJobs")}
          </Link>
        </section>
      ) : (
        <Job job={job.data} id={id} />
      )}
    </CareersFrame>
  );
}

function Job({ job, id }: { job: CareerOpening; id: string }) {
  const { t } = useTranslation();
  const format = useFormat();
  const en = format.lang === "en";
  const pick = (ar: string, english: string) => (en ? english || ar : ar);
  return (
    <>
      <article aria-labelledby="job-title" className="flex flex-col gap-4 rounded-panel border border-white/80 bg-white/70 p-5 shadow-soft backdrop-blur-sm sm:p-6">
        <h1 id="job-title" className="text-2xl font-bold">{pick(job.title_ar, job.title_en)}</h1>
        <p className="text-muted">
          {format.name(job.company)}
          {job.city && ` · ${format.name(job.city)}`} · {t(`recruitment.employmentTypes.${job.employment_type}`)}
          {job.close_on && <span className="num"> · {t("careers.closesOn", { date: format.date(job.close_on) })}</span>}
        </p>
        <p className="whitespace-pre-line leading-7">{pick(job.description_ar, job.description_en)}</p>
        {(job.requirements_ar || job.requirements_en) && (
          <>
            <h2 className="text-lg font-semibold">{t("careers.requirements")}</h2>
            <p className="whitespace-pre-line leading-7">{pick(job.requirements_ar, job.requirements_en)}</p>
          </>
        )}
      </article>
      <ApplyForm job={job} id={id} />
    </>
  );
}

type Values = { full_name: string; email: string; phone: string; id_number: string; nationality: string; city: string; expected_salary: string; cover_letter: string };
const EMPTY: Values = { full_name: "", email: "", phone: "", id_number: "", nationality: "", city: "", expected_salary: "", cover_letter: "" };

function ApplyForm({ job, id }: { job: CareerOpening; id: string }) {
  const { t } = useTranslation();
  const format = useFormat();
  const en = format.lang === "en";
  const [v, setV] = useState<Values>(EMPTY);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [cv, setCv] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [pool, setPool] = useState(false);
  const [captcha, setCaptcha] = useState("");
  const send = useMutation({
    mutationFn: () => {
      const body = new FormData();
      Object.entries(v).forEach(([key, value]) => value && body.append(key, value));
      body.append("answers", JSON.stringify(answers));
      body.append("consent", String(consent));
      body.append("notice_version", String(job.notice.version));
      body.append("talent_pool", String(pool));
      body.append("captcha", captcha);
      body.append("language", format.lang);
      if (cv) body.append("cv", cv);
      return careersApi.apply(id, body);
    },
  });
  const errors = apiErrors(send.error, t("careers.sendFailed"));
  const field = (name: keyof Values) => ({ name, value: v[name], onChange: (e: { target: { value: string } }) => setV({ ...v, [name]: e.target.value }), error: errors.fields[name] });
  if (send.isSuccess)
    return (
      <section role="status" className="flex items-center gap-3 rounded-panel bg-green-100 p-6 text-green-800 shadow-soft">
        <CircleCheck aria-hidden="true" className="size-7 shrink-0" />
        <div>
          <p className="font-semibold">{t("careers.received")}</p>
          <p className="text-sm">{t("careers.receivedBody")}</p>
        </div>
      </section>
    );
  const ready = v.full_name.trim() && v.email.trim() && v.phone.trim() && cv && consent && (!job.captcha_site_key || captcha);
  return (
    <section aria-labelledby="apply-title" className="flex flex-col gap-4 rounded-panel border border-white/80 bg-white/70 p-5 shadow-soft backdrop-blur-sm sm:p-6">
      <h2 id="apply-title" className="text-xl font-bold">{t("careers.apply")}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t("careers.fields.full_name")} autoComplete="name" {...field("full_name")} />
        <TextField label={t("careers.fields.email")} type="email" dir="ltr" autoComplete="email" {...field("email")} />
        <TextField label={t("careers.fields.phone")} type="tel" dir="ltr" autoComplete="tel" {...field("phone")} />
        <TextField label={t("careers.fields.id_number")} dir="ltr" {...field("id_number")} />
        <FormSelect label={t("careers.fields.nationality")} placeholder={t("common.choose")} options={job.countries.map((c) => ({ value: c.code, label: format.name(c) }))} {...field("nationality")} />
        <TextField label={t("careers.fields.city")} {...field("city")} />
        <TextField label={t("careers.fields.expected_salary")} inputMode="decimal" dir="ltr" {...field("expected_salary")} />
      </div>
      {job.questions.map((q) => {
        const label = `${en ? q.text_en || q.text_ar : q.text_ar}${q.required ? " *" : ""}`;
        const value = answers[q.key!] ?? "";
        const set = (next: string) => setAnswers({ ...answers, [q.key!]: next });
        if (q.kind === "yes_no" || q.kind === "choice") {
          const options = q.kind === "yes_no" ? [{ value: "yes", label: t("common.yes") }, { value: "no", label: t("common.no") }] : q.choices.map((c) => ({ value: c.ar, label: en ? c.en || c.ar : c.ar }));
          return <FormSelect key={q.key} label={label} name={`answer_${q.key}`} placeholder={t("common.choose")} value={value} onChange={(e) => set(e.target.value)} options={options} />;
        }
        return <TextField key={q.key} label={label} name={`answer_${q.key}`} inputMode={q.kind === "number" ? "decimal" : undefined} value={value} onChange={(e) => set(e.target.value)} />;
      })}
      {errors.fields.answers && <Alert>{errors.fields.answers}</Alert>}
      <TextArea label={t("careers.fields.cover_letter")} name="cover_letter" rows={4} value={v.cover_letter} onChange={(e) => setV({ ...v, cover_letter: e.target.value })} />
      <FileDrop label={t("careers.fields.cv")} accept=".pdf,.jpg,.jpeg,.png" file={cv} onChange={setCv} error={errors.fields.cv} />
      <div className="flex flex-col gap-2 rounded-card bg-neutral-soft p-4">
        <p className="text-sm font-semibold">{t("careers.notice", { version: job.notice.version })}</p>
        <p className="max-h-48 overflow-y-auto whitespace-pre-line text-sm leading-6">{en ? job.notice.text_en || job.notice.text_ar : job.notice.text_ar}</p>
        <CheckField label={t("careers.consent")} checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        {job.talent_pool && <CheckField label={t("careers.talentPool")} checked={pool} onChange={(e) => setPool(e.target.checked)} />}
        {errors.fields.consent && <p className="text-sm text-danger">{errors.fields.consent}</p>}
      </div>
      {job.captcha_site_key && <Turnstile siteKey={job.captcha_site_key} language={format.lang} onToken={setCaptcha} />}
      {errors.fields.captcha && <p className="text-sm text-danger">{errors.fields.captcha}</p>}
      {(errors.general || errors.fields.detail) && <Alert>{errors.fields.detail ?? errors.general}</Alert>}
      <Button variant="accent" className="self-start" disabled={!ready || send.isPending} onClick={() => send.mutate()}>
        {send.isPending ? t("careers.sending") : t("careers.send")}
      </Button>
    </section>
  );
}

type TurnstileApi = { render: (el: HTMLElement, options: Record<string, unknown>) => string; remove: (id: string) => void };
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** Cloudflare Turnstile (TO CONFIRM): the script is loaded only when the server gives a site key. */
function Turnstile({ siteKey, language, onToken }: { siteKey: string; language: string; onToken: (token: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let widget = "";
    let cancelled = false;
    const render = () => {
      if (cancelled || !box.current || !window.turnstile) return;
      widget = window.turnstile.render(box.current, { sitekey: siteKey, language, callback: onToken, "expired-callback": () => onToken("") });
    };
    if (window.turnstile) render();
    else {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = render;
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
      if (widget) window.turnstile?.remove(widget);
    };
  }, [siteKey, language, onToken]);
  return <div ref={box} />;
}
