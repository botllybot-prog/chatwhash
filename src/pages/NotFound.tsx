import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAppLanguage } from "@/lib/language";

const texts = {
  ar: {
    message: "عذراً! الصفحة غير موجودة",
    home: "العودة إلى الرئيسية",
  },
  en: {
    message: "Oops! Page not found",
    home: "Return to home",
  },
  ku: {
    message: "ببورە! ئەم پەڕەیە نەدۆزرایەوە",
    home: "گەڕانەوە بۆ سەرەکی",
  },
  tr: {
    message: "Üzgünüz! Sayfa bulunamadı",
    home: "Ana sayfaya dön",
  },
} as const;

const NotFound = () => {
  const location = useLocation();
  const { language } = useAppLanguage();
  const t = texts[language];

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">{t.message}</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          {t.home}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
