import { useQuery } from "@tanstack/react-query";
import { CircleCheck, CircleX, Languages } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";

import { ApiError } from "@/api";
import { letters } from "@/api/letters";
import { Button } from "@/design/Button";
import { Logo } from "@/layout/Logo";
import { useFormat } from "@/lib/useFormat";

/** /verify/:token — public (the QR code on a letter, decision 9): valid or revoked, the letter type, reference,
 * issue date, company and employee name. No sign-in; the language switch here doesn't change a signed-in user's
 * preference. */
export default function VerifyPage() {
  const { t, i18n } = useTranslation();
  const format = useFormat();
  const { token = "" } = useParams();
  const result = useQuery({ queryKey: ["letter-verify", token], queryFn: () => letters.verify(token), retry: false });
  const otherLanguage = i18n.language === "ar" ? "en" : "ar";
  const notFound = result.error instanceof ApiError && result.error.status === 404;
  const data = result.data;

  useEffect(() => {
    document.title = `${t("verify.title")} · ${t("app.name")}`;
  }, [t]);

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-4 flex justify-end">
          <Button variant="ghost" size="sm" icon={<Languages className="size-4" />} iconPosition="start" onClick={() => void i18n.changeLanguage(otherLanguage)}>
            <span lang={otherLanguage}>{t(`languages.${otherLanguage}`)}</span>
          </Button>
        </div>
        <section aria-labelledby="verify-title" className="rounded-panel border border-white/80 bg-white/70 p-6 shadow-soft backdrop-blur-sm sm:p-8">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <Logo className="size-12" />
            <h1 id="verify-title" className="text-2xl font-bold">{t("verify.title")}</h1>
          </div>
          {result.isPending ? (
            <p className="text-center text-muted">{t("common.loading")}</p>
          ) : !data ? (
            <div role="alert" className="flex items-center gap-3 rounded-card bg-danger-soft p-4 text-danger">
              <CircleX aria-hidden="true" className="size-6 shrink-0" />
              <p className="font-semibold">{notFound ? t("verify.notFound") : t("common.loadFailed")}</p>
            </div>
          ) : (
            <>
              <div role="status" className={`flex items-center gap-3 rounded-card p-4 ${data.valid ? "bg-green-100 text-green-800" : "bg-danger-soft text-danger"}`}>
                {data.valid ? <CircleCheck aria-hidden="true" className="size-6 shrink-0" /> : <CircleX aria-hidden="true" className="size-6 shrink-0" />}
                <div>
                  <p className="font-semibold">{t(`verify.${data.status}`)}</p>
                  <p className="text-sm">{t(`verify.${data.status}Body`)}</p>
                </div>
              </div>
              <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                {[
                  ["letter", format.pick(data.letter)],
                  ["reference", <span key="r" dir="ltr" className="num">{data.reference}</span>],
                  ["issuedOn", <span key="d" className="num">{format.date(data.issued_on)}</span>],
                  ["company", format.pick(data.company)],
                  ["employee", format.pick(data.employee)],
                ].map(([key, value]) => (
                  <div key={String(key)}>
                    <dt className="text-sm text-muted">{t(`verify.fields.${key}`)}</dt>
                    <dd className="mt-1 font-semibold text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
