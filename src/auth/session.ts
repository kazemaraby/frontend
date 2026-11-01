import { createContext, useContext } from "react";

import type { Language } from "@/i18n";
import type { Me, MeBranch, MeCompany } from "@/api";

export type SessionStatus = "loading" | "anonymous" | "authenticated" | "error";

export type Session = {
  status: SessionStatus;
  /** True after the user signed out themselves (as opposed to an expired session). */
  signedOutByUser: boolean;
  me: Me | null;
  companies: MeCompany[];
  /** Active company (sent as X-Company-Id). Null only when the user has no company at all. */
  company: MeCompany | null;
  /** Active branch (sent as X-Branch-Id); null = all branches. */
  branch: MeBranch | null;
  selectCompany: (companyId: number, branchId: number | null) => void;
  /** Permission codes the user holds in the active company. */
  permissions: ReadonlySet<string>;
  can: (code: string | undefined) => boolean;
  /** Module in the tenant's plan (apps.tenants.Module values). */
  hasModule: (module: string | undefined) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setLanguage: (lng: Language) => void;
  retry: () => void;
};

export const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside <AuthProvider>");
  return session;
}

/** Part of every query key for company data, so switching company or branch never shows another one's cache. */
export function useScopeKey() {
  const { company, branch } = useSession();
  return [company?.id ?? null, branch?.id ?? null] as const;
}

export function displayName(me: Pick<Me, "full_name_ar" | "full_name_en" | "email">, lang: string) {
  const name = lang === "en" ? me.full_name_en || me.full_name_ar : me.full_name_ar || me.full_name_en;
  return name || me.email;
}
