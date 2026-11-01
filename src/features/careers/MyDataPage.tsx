import { useMutation, useQuery } from "@tanstack/react-query";
import { CircleCheck, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";

import { ApiError } from "@/api";
import { type CandidateData, candidateDataApi } from "@/api/recruitment";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { CheckField, TextField } from "@/design/Field";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

import { CareersFrame } from "./CareersPage";

/** /careers/my-data — public: a candidate asks for a link to their data (PDPL); the answer is the same whether or
 * not we hold any. */
export function MyDataRequestPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const send = useMutation({ mutationFn: () => candidateDataApi.request(email) });
  return (
    <CareersFrame title={t("myData.title")}>
      <section aria-labelledby="my-data" className="flex flex-col gap-4 rounded-panel border border-white/80 bg-white/70 p-5 shadow-soft sm:p-6">
        <h1 id="my-data" className="text-2xl font-bold">{t("myData.title")}</h1>
        <p className="text-muted">{t("myData.intro")}</p>
        {send.isSuccess ? (
          <p role="status" className="flex items-center gap-2 rounded-card bg-green-100 p-4 text-green-800">
            <CircleCheck aria-hidden="true" className="size-5" /> {t("myData.sent")}
          </p>
        ) : (
          <>
            <TextField label={t("careers.fields.email")} name="email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} error={apiErrors(send.error, "").fields.email} />
            <Button variant="accent" className="self-start" disabled={!email.includes("@") || send.isPending} onClick={() => send.mutate()}>
              {t("myData.send")}
            </Button>
          </>
        )}
      </section>
    </CareersFrame>
  );
}

/** /careers/my-data/:token — public: what is held about the candidate, its download, keeping it for other jobs or
 * not, and deleting it (not while hired or under offer). */
export default function MyDataPage() {
  const { t, i18n } = useTranslation();
  const { token = "" } = useParams();
  const query = useQuery({ queryKey: ["my-data", token], queryFn: () => candidateDataApi.get(token), retry: false });
  const language = query.data?.language;
  useEffect(() => {
    if (language && language !== i18n.language) void i18n.changeLanguage(language);
  }, [language, i18n]);
  const gone = query.error instanceof ApiError && query.error.status === 404;
  return (
    <CareersFrame title={t("myData.title")}>
      {query.isPending ? (
        <p className="text-muted">{t("common.loading")}</p>
      ) : !query.data ? (
        <section className="rounded-panel bg-white/70 p-6 shadow-soft">
          <p role="alert" className="font-semibold">{gone ? t("myData.invalid") : t("careers.unavailable")}</p>
        </section>
      ) : (
        <Data initial={query.data} token={token} />
      )}
    </CareersFrame>
  );
}

function Data({ initial, token }: { initial: CandidateData; token: string }) {
  const { t } = useTranslation();
  const format = useFormat();
  const en = format.lang === "en";
  const [data, setData] = useState(initial);
  const [agree, setAgree] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const renew = useMutation({ mutationFn: () => candidateDataApi.renew(token, data.notice.version), onSuccess: (next) => setData({ ...data, ...next }) });
  const withdraw = useMutation({ mutationFn: () => candidateDataApi.withdrawPool(token), onSuccess: (next) => setData({ ...data, ...next }) });
  const remove = useMutation({ mutationFn: () => candidateDataApi.remove(token) });
  const error = [renew, withdraw, remove].find((m) => m.isError)?.error;
  if (remove.isSuccess)
    return (
      <p role="status" className="flex items-center gap-2 rounded-panel bg-green-100 p-6 text-green-800">
        <CircleCheck aria-hidden="true" className="size-6" /> {t("myData.deleted")}
      </p>
    );
  const pick = (v: { ar: string; en: string }) => (en ? v.en || v.ar : v.ar);
  const you: [string, string][] = [
    ["full_name", data.you.full_name], ["email", data.you.email], ["phone", data.you.phone], ["id_number", data.you.id_number], ["city", data.you.city], ["expected_salary", data.you.expected_salary ?? ""],
  ];
  return (
    <article aria-labelledby="my-data" className="flex flex-col gap-5 rounded-panel border border-white/80 bg-white/70 p-5 shadow-soft sm:p-6">
      <div>
        <h1 id="my-data" className="text-2xl font-bold">{t("myData.title")}</h1>
        <p className="mt-1 text-muted">{pick(data.company)} · {t("myData.keptUntil", { date: format.date(data.kept_until) })}</p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        {you.filter(([, v]) => v).map(([key, value]) => (
          <div key={key}>
            <dt className="text-sm text-muted">{t(`careers.fields.${key}`)}</dt>
            <dd className="font-medium" dir={key === "email" || key === "phone" ? "ltr" : undefined}>{value}</dd>
          </div>
        ))}
      </dl>
      <section aria-label={t("myData.applications")} className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t("myData.applications")}</h2>
        {data.applications.map((a, i) => (
          <p key={i} className="rounded-card bg-neutral-soft p-3 text-sm">
            <span className="font-medium">{pick(a.job)}</span> · <span className="num">{format.date(a.applied_at)}</span> · {t(`recruitment.stages.${a.stage}`)}
          </p>
        ))}
      </section>
      <a href={candidateDataApi.downloadUrl(token)} className="inline-flex items-center gap-2 self-start font-medium text-teal-dark hover:underline">
        <Download aria-hidden="true" className="size-4" /> {t("myData.download")}
      </a>
      <section aria-label={t("myData.pool")} className="flex flex-col gap-3 rounded-card border border-line p-4">
        <h2 className="font-semibold">{t("myData.pool")}</h2>
        {data.talent_pool ? (
          <>
            <p className="text-sm">{t("myData.inPool")}</p>
            <Button variant="outline" className="self-start" disabled={withdraw.isPending} onClick={() => withdraw.mutate()}>
              {t("myData.leavePool")}
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted">{t("myData.notInPool")}</p>
        )}
        <p className="max-h-40 overflow-y-auto whitespace-pre-line text-sm leading-6 text-muted">{en ? data.notice.text_en || data.notice.text_ar : data.notice.text_ar}</p>
        <CheckField label={t("myData.agree")} checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <Button variant="accent" className="self-start" disabled={!agree || renew.isPending} onClick={() => renew.mutate()}>
          {t("myData.keep")}
        </Button>
      </section>
      <section aria-label={t("myData.delete")} className="flex flex-col gap-3 rounded-card border border-line p-4">
        <h2 className="font-semibold">{t("myData.delete")}</h2>
        {data.can_delete ? (
          <>
            <p className="text-sm">{t("myData.deleteBody")}</p>
            <Button variant="outline" className="self-start" disabled={remove.isPending} onClick={() => (confirming ? remove.mutate() : setConfirming(true))}>
              {confirming ? t("myData.confirmDelete") : t("myData.delete")}
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted">{t("myData.cantDelete")}</p>
        )}
      </section>
      {error && <Alert>{apiErrors(error, t("common.saveFailed")).fields.detail ?? apiErrors(error, t("common.saveFailed")).general}</Alert>}
    </article>
  );
}
