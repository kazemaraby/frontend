import { useMutation, useQuery } from "@tanstack/react-query";
import { CircleCheck, CircleX, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";

import { ApiError } from "@/api";
import { type OfferPage as Data, offersApi } from "@/api/recruitment";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { TextArea } from "@/design/Field";
import { Money } from "@/design/Money";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

import { CareersFrame } from "./CareersPage";

/** /offer/:token — public: the candidate's job offer (the signed link from the e-mail is the credential). They read
 * it, download the letter and accept or decline it until its date. */
export default function OfferPage() {
  const { t, i18n } = useTranslation();
  const { token = "" } = useParams();
  const offer = useQuery({ queryKey: ["offer-link", token], queryFn: () => offersApi.page(token), retry: false });
  const language = offer.data?.language;
  useEffect(() => {
    if (language && language !== i18n.language) void i18n.changeLanguage(language); // the language they applied in
  }, [language]);
  const gone = offer.error instanceof ApiError && offer.error.status === 404;
  return (
    <CareersFrame title={t("offerPage.title")}>
      {offer.isPending ? (
        <p className="text-muted">{t("common.loading")}</p>
      ) : !offer.data ? (
        <section className="rounded-panel bg-white/70 p-6 shadow-soft">
          <p role="alert" className="font-semibold">{gone ? t("offerPage.invalid") : t("careers.unavailable")}</p>
        </section>
      ) : (
        <Offer data={offer.data} token={token} />
      )}
    </CareersFrame>
  );
}

function Offer({ data, token }: { data: Data; token: string }) {
  const { t } = useTranslation();
  const format = useFormat();
  const en = format.lang === "en";
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const answer = useMutation({ mutationFn: (decision: "accept" | "decline") => offersApi.respond(token, decision, reason) });
  const response = answer.data?.response ?? data.response;
  const rows: [string, string][] = [
    [t("offerPage.position"), `${format.name(data.job_title)} · ${format.name(data.department)}`],
    [t("recruitment.offers.startDate"), `${format.date(data.start_date)} (${format.hijri(data.start_date)})`],
    [t("recruitment.offers.contractType"), `${format.name(data.contract_type)}${data.contract_months ? ` · ${t("offerPage.months", { n: data.contract_months })}` : ""}`],
    [t("offerPage.probation"), t("offerPage.days", { n: data.probation_days })],
    ...(data.branch ? ([[t("offerPage.location"), format.name(data.branch)]] as [string, string][]) : []),
  ];
  return (
    <article aria-labelledby="offer-title" className="flex flex-col gap-5 rounded-panel border border-white/80 bg-white/70 p-5 shadow-soft backdrop-blur-sm sm:p-6">
      <div>
        <h1 id="offer-title" className="text-2xl font-bold">{t("offerPage.title")}</h1>
        <p className="mt-1 text-muted">
          {format.name(data.company)} · <span dir="ltr">{data.reference}</span>
        </p>
      </div>
      <p>{t("offerPage.intro", { name: data.candidate, company: format.name(data.company), title: format.name(data.job_title) })}</p>
      <dl className="grid gap-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <section aria-label={t("recruitment.offers.breakdown")} className="flex flex-col gap-1 rounded-card bg-neutral-soft p-4 text-sm">
        {data.lines.filter((ln) => Number(ln.amount) !== 0).map((ln, i) => (
          <p key={i} className={`flex justify-between ${ln.kind === "deduction" ? "text-danger" : ""}`}>
            <span>{format.name(ln)}</span>
            <Money amount={ln.amount} currency={data.currency} />
          </p>
        ))}
        <p className="mt-1 flex justify-between border-t border-line pt-2 font-semibold">
          <span>{t("recruitment.offers.total")}</span>
          <Money amount={data.monthly_total} currency={data.currency} />
        </p>
      </section>
      {(en ? data.terms_en || data.terms_ar : data.terms_ar) && <p className="whitespace-pre-line">{en ? data.terms_en || data.terms_ar : data.terms_ar}</p>}
      <a href={offersApi.letterUrl(token)} className="inline-flex items-center gap-2 self-start font-medium text-teal-dark hover:underline">
        <Download aria-hidden="true" className="size-4" /> {t("offerPage.download")}
      </a>
      {response === "waiting" ? (
        <div className="flex flex-col gap-3 rounded-card border border-line p-4">
          <p className="font-medium">{t("offerPage.answerBy", { date: format.date(data.valid_until) })}</p>
          {declining && <TextArea label={t("offerPage.reason")} name="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />}
          {answer.isError && <Alert>{apiErrors(answer.error, t("common.saveFailed")).fields.detail ?? apiErrors(answer.error, t("common.saveFailed")).general}</Alert>}
          <div className="flex flex-wrap gap-2">
            {!declining && (
              <Button variant="accent" disabled={answer.isPending} onClick={() => answer.mutate("accept")}>
                {t("offerPage.accept")}
              </Button>
            )}
            <Button variant="outline" disabled={answer.isPending} onClick={() => (declining ? answer.mutate("decline") : setDeclining(true))}>
              {declining ? t("offerPage.confirmDecline") : t("offerPage.decline")}
            </Button>
          </div>
        </div>
      ) : (
        <div role="status" className={`flex items-center gap-3 rounded-card p-4 ${response === "accepted" ? "bg-green-100 text-green-800" : "bg-neutral-soft text-ink"}`}>
          {response === "accepted" ? <CircleCheck aria-hidden="true" className="size-6" /> : <CircleX aria-hidden="true" className="size-6" />}
          <p className="font-semibold">{t(`offerPage.status.${response || "withdrawn"}`)}</p>
        </div>
      )}
    </article>
  );
}
