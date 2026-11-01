import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { api, endpoints, onSignedOut, scope, type Me } from "@/api";
import type { Language } from "@/i18n";

import { type Session, SessionContext, type SessionStatus } from "./session";

type Selection = { companyId: number; branchId: number | null };

const storageKey = (me: Me) => `smarthr.company.${me.tenant.schema}.${me.id}`;

function readSelection(me: Me): Selection | null {
  try {
    const raw = localStorage.getItem(storageKey(me));
    return raw ? (JSON.parse(raw) as Selection) : null;
  } catch {
    return null;
  }
}

function writeSelection(me: Me, selection: Selection) {
  try {
    localStorage.setItem(storageKey(me), JSON.stringify(selection));
  } catch {
    // not remembered; the default company is used next time
  }
}

/** Signs in, restores the session after a reload, loads /me and owns the active company. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  // booting: trying the refresh cookie; then signed in or not. /me loads once signed in.
  const [phase, setPhase] = useState<"booting" | "signedIn" | "signedOut">("booting");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [signedOutByUser, setSignedOutByUser] = useState(false);

  useEffect(() => {
    let alive = true;
    // StrictMode runs this twice; the client shares one refresh call, so the cookie is rotated only once.
    api
      .refresh()
      .catch(() => false)
      .then((ok) => alive && setPhase(ok ? "signedIn" : "signedOut"));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(
    () =>
      onSignedOut(() => {
        setPhase("signedOut");
        setSelection(null);
        queryClient.removeQueries();
      }),
    [queryClient],
  );

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: endpoints.me,
    enabled: phase === "signedIn",
    staleTime: 5 * 60_000,
  });
  const me = phase === "signedIn" ? (meQuery.data ?? null) : null;
  const refetchMe = meQuery.refetch;

  // The account's language wins once per sign-in; later changes go through setLanguage.
  const languageAppliedFor = useRef<number | null>(null);
  useEffect(() => {
    if (!me || languageAppliedFor.current === me.id) return;
    languageAppliedFor.current = me.id;
    if (me.preferred_language !== i18n.language) void i18n.changeLanguage(me.preferred_language);
  }, [me, i18n]);

  const { company, branch } = useMemo(() => {
    if (!me || me.companies.length === 0) return { company: null, branch: null };
    const wanted = selection ?? readSelection(me);
    const company =
      me.companies.find((c) => c.id === wanted?.companyId) ??
      me.companies.find((c) => c.id === me.default_company_id) ??
      me.companies[0];
    const branch = wanted?.companyId === company.id ? (company.branches.find((b) => b.id === wanted.branchId) ?? null) : null;
    return { company, branch };
  }, [me, selection]);

  // Written during render (not in an effect) so the very first queries of the children already carry the headers.
  scope.companyId = company?.id ?? null;
  scope.branchId = branch?.id ?? null;

  const permissions = useMemo(
    () => new Set(company && me ? (me.permissions[String(company.id)] ?? []) : []),
    [me, company],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      await api.login(email, password);
      queryClient.removeQueries();
      await queryClient.fetchQuery({ queryKey: ["me"], queryFn: endpoints.me });
      languageAppliedFor.current = null;
      setSelection(null);
      setSignedOutByUser(false);
      setPhase("signedIn");
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // offline: the token is dropped locally anyway and the cookie expires on its own
    }
    queryClient.removeQueries();
    languageAppliedFor.current = null;
    setSelection(null);
    setSignedOutByUser(true);
    setPhase("signedOut");
  }, [queryClient]);

  const setLanguage = useCallback(
    (lng: Language) => {
      void i18n.changeLanguage(lng);
      if (phase !== "signedIn") return;
      endpoints
        .updateMe({ preferred_language: lng })
        .then((updated) => queryClient.setQueryData(["me"], updated))
        .catch(() => undefined); // the UI already switched; the preference syncs on the next change
    },
    [i18n, phase, queryClient],
  );

  let status: SessionStatus = "loading";
  if (phase === "signedOut") status = "anonymous";
  else if (phase === "signedIn" && me) status = "authenticated";
  else if (phase === "signedIn" && meQuery.isError) status = "error";

  const value = useMemo<Session>(
    () => ({
      status,
      signedOutByUser,
      me,
      companies: me?.companies ?? [],
      company,
      branch,
      selectCompany: (companyId, branchId) => {
        const next = { companyId, branchId };
        setSelection(next);
        if (me) writeSelection(me, next);
      },
      permissions,
      can: (code) => !code || permissions.has(code),
      hasModule: (module) => !module || Boolean(me?.tenant.modules.includes(module)),
      login,
      logout,
      setLanguage,
      retry: () => void refetchMe(),
    }),
    [status, signedOutByUser, me, company, branch, permissions, login, logout, setLanguage, refetchMe],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
