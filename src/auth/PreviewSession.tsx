import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { Me } from "@/api";
import { currentUser, companies, previewTenant } from "@/mocks/org";

import { type Session, SessionContext } from "./session";

const me: Me = {
  id: 0,
  email: currentUser.email,
  full_name_ar: currentUser.name_ar,
  full_name_en: currentUser.name_en,
  preferred_language: "ar",
  is_tenant_admin: true,
  tenant: { ...previewTenant, status: "active", modules: [] },
  default_company_id: companies[0].id,
  companies: companies.map((c) => ({ ...c, logo: null })),
  permissions: {},
  employee: null,
};

/** A signed-in looking session with every permission, for /dev/components (no backend needed). */
export function PreviewSession({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const value: Session = {
    status: "authenticated",
    signedOutByUser: false,
    me,
    companies: me.companies,
    company: me.companies[0],
    branch: null,
    selectCompany: () => undefined,
    permissions: new Set(),
    can: () => true,
    hasModule: () => true,
    login: async () => undefined,
    logout: async () => undefined,
    setLanguage: (lng) => void i18n.changeLanguage(lng),
    retry: () => undefined,
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
