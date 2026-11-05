import { useMutation } from "@tanstack/react-query";
import { CircleCheck } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiError } from "@/api";
import { passwordLinkApi } from "@/api/users";
import { Button } from "@/design/Button";
import { TextField } from "@/design/Field";

/** "Forgot your password?" on the sign-in page: e-mails the password link. The answer is the same for any address. */
export function ForgotPasswordForm({ initialEmail, onBack }: { initialEmail: string; onBack: () => void }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState(initialEmail);
  const send = useMutation({ mutationFn: () => passwordLinkApi.forgot(email.trim()) });
  const status = send.error instanceof ApiError ? send.error.status : null;
  const error =
    status === 429 ? t("login.errors.throttled") : status === 400 ? t("login.forgot.invalid") : status === 0 ? t("login.errors.network") : send.error ? t("login.errors.generic") : null;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (email.trim()) send.mutate();
  }

  if (send.isSuccess) {
    return (
      <div className="flex flex-col gap-5">
        <p role="status" className="flex items-start gap-2 rounded-card bg-teal-soft p-4 text-sm text-teal-ink">
          <CircleCheck className="mt-0.5 size-4 shrink-0" />
          {t("login.forgot.sent")}
        </p>
        <Button variant="outline" className="h-12 w-full" onClick={onBack}>{t("login.forgot.back")}</Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <p className="text-sm text-muted">{t("login.forgot.intro")}</p>
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
      {error && (
        <p role="alert" className="rounded-card bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <Button type="submit" className="h-12 w-full" disabled={send.isPending || !email.trim()}>
        {send.isPending ? t("login.forgot.sending") : t("login.forgot.submit")}
      </Button>
      <Button variant="ghost" className="w-full" onClick={onBack}>{t("login.forgot.back")}</Button>
    </form>
  );
}
