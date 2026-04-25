import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type AppLanguage = "ar" | "en" | "ku" | "tr";

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  isRtl: boolean;
  locale: string;
};

const STORAGE_KEY = "washlly-app-language";

const LanguageContext = createContext<LanguageContextValue | null>(null);

export const APP_LANGUAGE_OPTIONS: { value: AppLanguage; label: string }[] = [
  { value: "ar", label: "عربي" },
  { value: "ku", label: "کوردی" },
  { value: "tr", label: "Türkçe" },
  { value: "en", label: "English" },
];

const LOCALES: Record<AppLanguage, string> = {
  ar: "ar-IQ",
  en: "en-US",
  ku: "ku-IQ",
  tr: "tr-TR",
};

export function AppLanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>("ar");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) as AppLanguage | null;
    if (saved && APP_LANGUAGE_OPTIONS.some((option) => option.value === saved)) {
      setLanguageState(saved);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language);
    const dir = language === "ar" || language === "ku" ? "rtl" : "ltr";
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage: setLanguageState,
      isRtl: language === "ar" || language === "ku",
      locale: LOCALES[language],
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useAppLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useAppLanguage must be used inside AppLanguageProvider");
  }

  return context;
}


