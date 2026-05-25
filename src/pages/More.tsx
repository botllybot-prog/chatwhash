import { Link } from "react-router-dom";
import { ChevronLeft, FileText, ShieldCheck, Smartphone } from "lucide-react";
import InstallAppButton from "@/components/InstallAppButton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppLanguage } from "@/lib/language";

const texts = {
  ar: {
    title: "المزيد",
    subtitle: "إعدادات وروابط مهمة لاستخدام واشلي.",
    install: "تثبيت التطبيق",
    privacy: "سياسة الخصوصية",
    privacyDesc: "كيف نحمي بيانات الزبائن وأصحاب المحطات داخل واشلي.",
    appInfo: "عن واشلي",
    appInfoDesc: "منصة حجز وإدارة مغاسل السيارات عبر الويب والتطبيق.",
    open: "فتح",
  },
  en: {
    title: "More",
    subtitle: "Important settings and links for using Washlly.",
    install: "Install app",
    privacy: "Privacy Policy",
    privacyDesc: "How Washlly protects customer and station owner data.",
    appInfo: "About Washlly",
    appInfoDesc: "A booking and management platform for car wash stations.",
    open: "Open",
  },
  ku: {
    title: "زیاتر",
    subtitle: "ڕێکخستن و بەستەری گرنگ بۆ بەکارهێنانی واشلی.",
    install: "دامەزراندنی ئەپ",
    privacy: "سیاسەتی تایبەتمەندی",
    privacyDesc: "چۆن واشلی زانیاری کڕیار و خاوەنی وێستگە دەپارێزێت.",
    appInfo: "دەربارەی واشلی",
    appInfoDesc: "پلاتفۆرمی حجز و بەڕێوەبردنی وێستگەکانی شۆردنی ئۆتۆمبێل.",
    open: "کردنەوە",
  },
  tr: {
    title: "Daha fazla",
    subtitle: "Washlly kullanımı için önemli ayarlar ve bağlantılar.",
    install: "Uygulamayı yükle",
    privacy: "Gizlilik Politikası",
    privacyDesc: "Washlly müşteri ve istasyon sahibi verilerini nasıl korur.",
    appInfo: "Washlly hakkında",
    appInfoDesc: "Araç yıkama istasyonları için rezervasyon ve yönetim platformu.",
    open: "Aç",
  },
} as const;

const More = () => {
  const { language, isRtl } = useAppLanguage();
  const t = texts[language];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6" dir={isRtl ? "rtl" : "ltr"}>
      <div className="mx-auto max-w-3xl space-y-4">
        <section className="rounded-3xl bg-gradient-to-br from-sky-600 to-blue-900 p-6 text-white shadow-lg">
          <p className="text-sm font-semibold text-sky-100">Washlly</p>
          <h1 className="mt-2 text-3xl font-black">{t.title}</h1>
          <p className="mt-2 max-w-xl text-sm leading-7 text-sky-50">{t.subtitle}</p>
        </section>

        <Card className="border-blue-100 shadow-sm">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground">{t.install}</h2>
                  <p className="text-sm text-muted-foreground">{t.appInfoDesc}</p>
                </div>
              </div>
              <InstallAppButton />
            </div>

            <Link
              to="/privacy-policy"
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background p-3 transition-colors hover:bg-blue-50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground">{t.privacy}</h2>
                  <p className="text-sm text-muted-foreground">{t.privacyDesc}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="gap-1">
                {t.open}
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>

            <div className="flex items-center gap-3 rounded-2xl border border-border bg-background p-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-foreground">{t.appInfo}</h2>
                <p className="text-sm text-muted-foreground">{t.appInfoDesc}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default More;
