import { useMutation, useQuery } from "@tanstack/react-query";
import { CircleCheck } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";

import { passwordLinkApi } from "@/api/users";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { TextField } from "@/design/Field";
import { Logo } from "@/layout/Logo";
import { apiErrors } from "@/lib/apiErrors";

/** /set-password/:uid/:token — public: the e-mailed invitation (or a new password link). The link works once, for 3
 * days; the password follows the server's rules. Then the person signs in as usual. */
export default function SetPasswordPage() {
  const { t } = useTranslation();
  const { uid = "", token = "" } = useParams();
  const link = useQuery({ queryKey: ["password-link", uid, token], queryFn: () => passwordLinkApi.check(uid, token), retry: false, staleTime: Infinity });
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const save = useMutation({ mutationFn: () => passwordLinkApi.set(uid, token, password) });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const mismatch = again.length > 0 && again !== password;

  useEffect(() => {
    document.title = `${t("setPassword.title")} · ${t("app.name")}`;
  }, [t]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!mismatch && password) save.mutate();
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <section className="w-full max-w-md rounded-panel border border-white/80 bg-white/70 p-6 shadow-soft backdrop-blur-sm sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo className="size-24" />
          <p dir="ltr" className="text-sm font-semibold tracking-wide text-muted">{t("app.name")}</p>
          <h1 className="text-[26px] font-bold">{t("setPassword.title")}</h1>
          {link.data?.valid && <p dir="ltr" className="font-semibold text-ink">{link.data.email}</p>}
        </div>
        {link.isPending ? (
          <p className="text-center text-muted">{t("common.loading")}</p>
        ) : save.isSuccess ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <div role="status" className="flex items-center gap-3 rounded-card bg-green-100 p-4 text-green-800">
              <CircleCheck aria-hidden="true" className="size-6" />
              {t("setPassword.done")}
            </div>
            <Link to="/login" className="font-semibold text-teal-dark hover:underline">{t("setPassword.signIn")}</Link>
          </div>
        ) : !link.data?.valid ? (
          <Alert>{t("setPassword.invalid")}</Alert>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
            <p className="text-sm text-muted">{t("setPassword.intro")}</p>
            <TextField label={t("setPassword.password")} name="password" type="password" dir="ltr" autoComplete="new-password" required autoFocus value={password} onChange={(e) => setPassword(e.target.value)} error={errors.fields.password} hint={t("setPassword.rules")} />
            <TextField label={t("setPassword.again")} name="password_again" type="password" dir="ltr" autoComplete="new-password" required value={again} onChange={(e) => setAgain(e.target.value)} error={mismatch ? t("setPassword.mismatch") : undefined} />
            {errors.general && <Alert>{errors.general}</Alert>}
            <Button type="submit" variant="accent" disabled={save.isPending || !password || mismatch}>{t("setPassword.save")}</Button>
          </form>
        )}
      </section>
    </main>
  );
}
