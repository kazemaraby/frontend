import { useQuery } from "@tanstack/react-query";
import { Briefcase, Languages, MapPin } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { careersApi } from "@/api/recruitment";
import { Button } from "@/design/Button";
import { Logo } from "@/layout/Logo";
import { useFormat } from "@/lib/useFormat";

/** The public frame of the careers pages: logo, language switch (not saved anywhere), content. */
export function CareersFrame({ title, children }: { title: string; children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const otherLanguage = i18n.language === "ar" ? "en" : "ar";
  useEffect(() => {
    document.title = `${title} · ${t("careers.title")}`;
  }, [title, t]);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between gap-3">
        <Link to="/careers" className="flex items-center gap-3">
          <Logo className="size-10" />
          <span className="text-lg font-bold text-ink">{t("careers.title")}</span>
        </Link>
        <Button variant="ghost" size="sm" icon={<Languages className="size-4" />} iconPosition="start" onClick={() => void i18n.changeLanguage(otherLanguage)}>
          <span lang={otherLanguage}>{t(`languages.${otherLanguage}`)}</span>
        </Button>
      </header>
      {children}
      <footer className="mt-auto text-center text-sm">
        <Link to="/careers/my-data" className="text-teal-dark hover:underline">
          {t("myData.link")}
        </Link>
      </footer>
    </main>
  );
}

/** /careers — public: the open jobs of every company of the account (no sign-in). */
export default function CareersPage() {
  const { t } = useTranslation();
  const format = useFormat();
  const list = useQuery({ queryKey: ["careers"], queryFn: careersApi.list, retry: false });
  const rows = list.data?.openings ?? [];
  return (
    <CareersFrame title={t("careers.openJobs")}>
      <section aria-labelledby="careers-jobs" className="rounded-panel border border-white/80 bg-white/70 p-5 shadow-soft backdrop-blur-sm sm:p-6">
        <h1 id="careers-jobs" className="mb-5 text-2xl font-bold">
          {t("careers.openJobs")}
        </h1>
        {list.isPending ? (
          <p className="text-muted">{t("common.loading")}</p>
        ) : list.isError ? (
          <p role="alert" className="text-danger">{t("careers.unavailable")}</p>
        ) : rows.length === 0 ? (
          <p className="text-muted">{t("careers.noJobs")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((o) => (
              <li key={o.id}>
                <Link to={`/careers/${o.id}`} className="flex flex-col gap-1 rounded-card bg-white p-4 shadow-soft transition-colors hover:bg-teal-soft/40">
                  <span className="text-lg font-semibold text-ink">{format.lang === "en" ? o.title_en || o.title_ar : o.title_ar}</span>
                  <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Briefcase aria-hidden="true" className="size-4" /> {format.name(o.company)} · {t(`recruitment.employmentTypes.${o.employment_type}`)}
                    </span>
                    {o.city && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin aria-hidden="true" className="size-4" /> {format.name(o.city)}
                      </span>
                    )}
                    {o.close_on && <span className="num">{t("careers.closesOn", { date: format.date(o.close_on) })}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </CareersFrame>
  );
}
