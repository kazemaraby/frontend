import { useQuery } from "@tanstack/react-query";
import { Languages, Smartphone } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { mobileApi } from "@/api/mobile";
import { useSession } from "@/auth/session";
import { Button } from "@/design/Button";
import { Logo } from "@/layout/Logo";

/** /app — public: the company's link for the mobile app. With the app installed, the phone opens the app instead
 * (app links: backend apps/mobile/links.py); otherwise this page gives the stores, the company code and the QR code
 * (scanned with a phone's camera it opens this link; scanned in the app it fills in the company). HR shows or prints
 * it for the team (Settings → Users and roles → Mobile app). */
export default function AppPage() {
  const { t, i18n } = useTranslation();
  const session = useSession();
  const config = useQuery({ queryKey: ["mobile-config"], queryFn: mobileApi.config, staleTime: Infinity, retry: false });
  const code = window.location.hostname.split(".")[0];
  const company = config.data ? (i18n.language === "en" ? config.data.tenant.name_en || config.data.tenant.name_ar : config.data.tenant.name_ar || config.data.tenant.name_en) : "";
  const stores = config.data?.store;
  const otherLanguage = i18n.language === "ar" ? "en" : "ar";

  useEffect(() => {
    document.title = `${t("mobileApp.title")} · ${t("app.name")}`;
  }, [t]);

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-4 flex justify-end print:hidden">
          <Button variant="ghost" size="sm" icon={<Languages className="size-4" />} iconPosition="start" onClick={() => session.setLanguage(otherLanguage)}>
            <span lang={otherLanguage}>{t(`languages.${otherLanguage}`)}</span>
          </Button>
        </div>
        <section className="rounded-panel border border-white/80 bg-white/70 p-6 shadow-soft backdrop-blur-sm sm:p-8">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <Logo className="size-20" />
            <h1 className="text-[26px] font-bold">{t("mobileApp.title")}</h1>
            {company && <p className="font-semibold text-teal-dark">{company}</p>}
            <p className="text-muted">{t("mobileApp.intro")}</p>
          </div>

          <ol className="flex flex-col gap-5">
            <li className="flex flex-col gap-3">
              <p className="font-semibold">{t("mobileApp.step1")}</p>
              {stores?.ios || stores?.android ? (
                <div className="flex flex-wrap gap-3">
                  {stores.ios && (
                    <a href={stores.ios} className="inline-flex h-11 items-center gap-2 rounded-full bg-navy px-5 font-medium text-white hover:bg-navy-hover">
                      <Smartphone className="size-4" /> {t("mobileApp.appStore")}
                    </a>
                  )}
                  {stores.android && (
                    <a href={stores.android} className="inline-flex h-11 items-center gap-2 rounded-full bg-navy px-5 font-medium text-white hover:bg-navy-hover">
                      <Smartphone className="size-4" /> {t("mobileApp.googlePlay")}
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted">{t("mobileApp.soon")}</p>
              )}
            </li>
            <li className="flex flex-col gap-3">
              <p className="font-semibold">{t("mobileApp.step2")}</p>
              <div className="flex flex-col items-center gap-4 rounded-card bg-white p-5 sm:flex-row">
                <img src={mobileApi.qrUrl} alt={t("mobileApp.qrAlt", { company: company || code })} className="size-40 shrink-0" />
                <div className="flex flex-col gap-1 text-center sm:text-start">
                  <p className="text-sm text-muted">{t("mobileApp.code")}</p>
                  <p dir="ltr" className="text-2xl font-bold tracking-wide">{code}</p>
                  <p className="text-sm text-muted">{t("mobileApp.scan")}</p>
                </div>
              </div>
            </li>
            <li className="flex flex-col gap-1">
              <p className="font-semibold">{t("mobileApp.step3")}</p>
              <p className="text-sm text-muted">{t("mobileApp.step3Body")}</p>
            </li>
          </ol>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="flex flex-wrap gap-4">
              <Link to="/login" className="font-semibold text-teal-dark hover:underline">{t("mobileApp.useWebsite")}</Link>
              <Link to="/privacy" className="text-teal-dark hover:underline">{t("privacyPolicy.title")}</Link>
            </div>
            <Button variant="outline" size="sm" onClick={() => window.print()}>{t("mobileApp.print")}</Button>
          </div>
        </section>
      </div>
    </main>
  );
}
