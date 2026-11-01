import i18next, { type i18n as I18n } from "i18next";
import { useEffect } from "react";
import { initReactI18next, useTranslation } from "react-i18next";

import ar from "./ar.json";
import en from "./en.json";

export const LANGUAGES = ["ar", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

const STORAGE_KEY = "smarthr.lang"; // also read by the inline script in index.html

export const dirFor = (lng: string) => (lng === "ar" ? "rtl" : "ltr");

const options = (lng: Language) => ({
  resources: { ar: { translation: ar }, en: { translation: en } },
  lng,
  fallbackLng: "ar",
  supportedLngs: LANGUAGES,
  interpolation: { escapeValue: false },
  initAsync: false,
  showSupportNotice: false,
});

function storedLanguage(): Language {
  try {
    return localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "ar";
  } catch {
    return "ar";
  }
}

void i18next.use(initReactI18next).init(options(storedLanguage()));

/** A separate instance pinned to one language, for rendering a subtree in that language (/dev/components). */
export function createI18n(lng: Language): I18n {
  const instance = i18next.createInstance();
  void instance.init(options(lng));
  return instance;
}

/** Keeps <html lang dir> and the remembered choice in sync with the app's language. Mount once, at the root. */
export function useDocumentLanguage() {
  const { i18n } = useTranslation();
  const lng = i18n.language;
  useEffect(() => {
    document.documentElement.lang = lng;
    document.documentElement.dir = dirFor(lng);
    try {
      localStorage.setItem(STORAGE_KEY, lng);
    } catch {
      // private mode / blocked storage: the choice just isn't remembered
    }
  }, [lng]);
}

export default i18next;
