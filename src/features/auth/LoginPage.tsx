import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, Languages } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";

import { ApiError, endpoints } from "@/api";
import { useSession } from "@/auth/session";
import { Button, IconButton } from "@/design/Button";
import { TextField } from "@/design/Field";
import { Logo } from "@/layout/Logo";

import { ForgotPasswordForm } from "./ForgotPasswordForm";

/** Only same-app paths are followed after sign-in (no open redirects). */
function safeNext(raw: string | null) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/login") ? raw : "/";
}

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const session = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);

  // The tenant is the subdomain; on the bare platform domain there is nobody to sign in to.
  const health = useQuery({ queryKey: ["health"], queryFn: endpoints.health, staleTime: Infinity, retry: false });
  const tenant = health.data?.tenant;
  const noTenant = tenant === "public" || (health.error instanceof ApiError && health.error.status === 404);
  const suspended = health.data?.tenant_status === "suspended" || health.data?.tenant_status === "cancelled";

  useEffect(() => {
    document.title = `${t("login.title")} · ${t("app.name")}`;
  }, [t]);

  if (session.status === "authenticated") return <Navigate to={next} replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await session.login(email.trim(), password);
      navigate(next, { replace: true });
    } catch (e) {
      const status = e instanceof ApiError ? e.status : -1;
      const code = e instanceof ApiError ? (e.body as { code?: string } | undefined)?.code : undefined;
      setError(
        code === "tenant_suspended"
          ? t("login.errors.suspended")
          : status === 401 || status === 400
          ? t("login.errors.invalid")
          : status === 429
            ? t("login.errors.throttled")
            : status === 0
              ? t("login.errors.network")
              : t("login.errors.generic"),
      );
    } finally {
      setBusy(false);
    }
  }

  const otherLanguage = i18n.language === "ar" ? "en" : "ar";
  const exampleHost = `cactus.${window.location.host}`;

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-4 flex justify-end">
          <Button variant="ghost" size="sm" icon={<Languages className="size-4" />} iconPosition="start" onClick={() => session.setLanguage(otherLanguage)}>
            <span lang={otherLanguage}>{t(`languages.${otherLanguage}`)}</span>
          </Button>
        </div>
        <section className="rounded-panel border border-white/80 bg-white/70 p-6 shadow-soft backdrop-blur-sm sm:p-8">
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <Logo className="size-24" />
            <p dir="ltr" className="text-sm font-semibold tracking-wide text-muted">{t("app.name")}</p>
            <h1 className="text-[26px] font-bold">{forgot ? t("login.forgot.title") : t("login.title")}</h1>
            {tenant && !noTenant && (
              <p className="text-muted">
                {t("login.workspace")}{" "}
                <span dir="ltr" className="font-semibold text-ink">
                  {window.location.hostname}
                </span>
              </p>
            )}
          </div>

          {suspended ? (
            <div role="alert" className="rounded-card bg-danger-soft p-4 text-sm text-danger">
              <p className="font-semibold">{t("login.suspendedTitle")}</p>
              <p className="mt-1">{t("login.suspendedBody")}</p>
            </div>
          ) : noTenant ? (
            <div role="alert" className="rounded-card bg-amber-100 p-4 text-sm text-amber-800">
              <p className="font-semibold">{t("login.noTenantTitle")}</p>
              <p className="mt-1">
                {t("login.noTenantBody")}{" "}
                <a dir="ltr" className="font-semibold underline" href={`${window.location.protocol}//${exampleHost}/login`}>
                  {exampleHost}
                </a>
              </p>
            </div>
          ) : forgot ? (
            <ForgotPasswordForm initialEmail={email} onBack={() => setForgot(false)} />
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
              <TextField
                label={t("login.email")}
                name="email"
                type="email"
                dir="ltr"
                autoComplete="username"
                inputMode="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <TextField
                label={t("login.password")}
                name="password"
                type={showPassword ? "text" : "password"}
                dir="ltr"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                trailing={
                  <IconButton
                    size="sm"
                    variant="plain"
                    tooltip={false}
                    label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
                    icon={showPassword ? <EyeOff /> : <Eye />}
                    onClick={() => setShowPassword((s) => !s)}
                  />
                }
              />
              {error && (
                <p role="alert" className="rounded-card bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
                  {error}
                </p>
              )}
              <Button type="submit" className="h-12 w-full" disabled={busy || !email || !password}>
                {busy ? t("login.signingIn") : t("login.submit")}
              </Button>
              <button type="button" className="cursor-pointer self-center text-sm font-semibold text-teal-dark hover:underline" onClick={() => setForgot(true)}>
                {t("login.forgot.link")}
              </button>
            </form>
          )}
        </section>
        <p className="mt-4 text-center text-sm">
          <Link to="/privacy" className="text-teal-dark hover:underline">{t("privacyPolicy.title")}</Link>
        </p>
      </div>
    </main>
  );
}
