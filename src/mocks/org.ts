import type { Named } from ".";

export type Branch = Named & { id: number; is_main: boolean };
export type Company = Named & { id: number; branches: Branch[] };

export const companies: Company[] = [
  {
    id: 1,
    name_ar: "شركة العميل",
    name_en: "Client Co.",
    branches: [
      { id: 1, name_ar: "الفرع الرئيسي", name_en: "Head office", is_main: true },
      { id: 2, name_ar: "فرع جدة", name_en: "Jeddah branch", is_main: false },
    ],
  },
  {
    id: 2,
    name_ar: "شركة العميل للتجارة",
    name_en: "Client Trading",
    branches: [{ id: 3, name_ar: "الفرع الرئيسي", name_en: "Head office", is_main: true }],
  },
];

export const previewTenant = { schema: "preview", name_ar: "معاينة", name_en: "Preview" };

export const currentUser = {
  email: "hr@cactus.localhost",
  name_ar: "سارة القحطاني",
  name_en: "Sara Al-Qahtani",
};
