import { Languages } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";

import { Button } from "@/design/Button";
import { Logo } from "@/layout/Logo";
import { useFormat } from "@/lib/useFormat";

/** When the policy last changed: change it with the text (privacyPolicy in ar.json / en.json). */
export const POLICY_DATE = "2026-11-05";

/** Where people write about their data. The mailbox must exist before the stores are given this page. */
const PRIVACY_EMAIL = import.meta.env.VITE_PRIVACY_EMAIL || "privacy@ssshrco.com";

const SECTIONS = ["who", "collect", "not", "why", "who_sees", "keep", "security", "rights", "contact", "changes"] as const;

/** A section's text: paragraphs, and lines starting with "- " as a list. */
function Body({ text }: { text: string }) {
  const lines = text.split("\n");
  const items = lines.filter((line) => line.startsWith("- "));
  if (!items.length) return <p className="leading-7 text-ink/90">{text}</p>;
  return (
    <ul className="flex list-disc flex-col gap-2 ps-5 leading-7 text-ink/90">
      {items.map((line) => <li key={line}>{line.slice(2)}</li>)}
    </ul>
  );
}

/** /privacy — public: the privacy policy of the website and the mobile app (the App Store and Google Play link to it,
 * and so do the app's sign-in and Me screens). `?lang=en` opens it in English. */
export default function PrivacyPage() {
  const { t, i18n } = useTranslation();
  const format = useFormat();
  const [params] = useSearchParams();
  const asked = params.get("lang");
  const otherLanguage = i18n.language === "ar" ? "en" : "ar";

  useEffect(() => {
    if ((asked === "ar" || asked === "en") && asked !== i18n.language) void i18n.changeLanguage(asked);
  }, [asked, i18n]);
  useEffect(() => {
    document.title = `${t("privacyPolicy.title")} · ${t("app.name")}`;
  }, [t]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between gap-3">
        <Link to="/login" className="flex items-center gap-3">
          <Logo className="size-10" />
          <span className="text-lg font-bold text-ink">{t("app.name")}</span>
        </Link>
        <Button variant="ghost" size="sm" icon={<Languages className="size-4" />} iconPosition="start" onClick={() => void i18n.changeLanguage(otherLanguage)}>
          <span lang={otherLanguage}>{t(`languages.${otherLanguage}`)}</span>
        </Button>
      </header>
      <article className="flex flex-col gap-6 rounded-panel border border-white/80 bg-white/70 p-5 shadow-soft sm:p-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] font-bold">{t("privacyPolicy.title")}</h1>
          <p className="text-muted">{t("privacyPolicy.subtitle")}</p>
          <p className="text-sm text-muted">{t("privacyPolicy.updated", { date: format.date(POLICY_DATE) })}</p>
        </div>
        {SECTIONS.map((id) => (
          <section key={id} aria-labelledby={`privacy-${id}`} className="flex flex-col gap-2">
            <h2 id={`privacy-${id}`} className="text-lg font-bold">{t(`privacyPolicy.sections.${id}.title`)}</h2>
            <Body text={t(`privacyPolicy.sections.${id}.body`, { email: PRIVACY_EMAIL })} />
          </section>
        ))}
      </article>
    </main>
  );
}
