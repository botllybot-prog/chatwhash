import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useAppLanguage } from "@/lib/language";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const labels = {
  ar: { install: "تثبيت التطبيق", unavailable: "التثبيت متاح من قائمة المتصفح (إضافة إلى الشاشة الرئيسية)." },
  en: { install: "Install app", unavailable: "Install from browser menu: Add to Home screen." },
  ku: { install: "دامەزراندنی ئەپ", unavailable: "لە مێنیۆی وێبگەڕەوە دامەزرێنە: زیادکردن بۆ شاشەی سەرەکی." },
  tr: { install: "Uygulamayı yükle", unavailable: "Tarayıcı menüsünden yükleyin: Ana ekrana ekle." },
} as const;

export default function InstallAppButton({ className = "" }: { className?: string }) {
  const { language } = useAppLanguage();
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showHint, setShowHint] = useState(false);
  const t = labels[language];

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!promptEvent) {
      setShowHint(true);
      return;
    }
    await promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
    setShowHint(false);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Button type="button" variant="outline" size="sm" className="gap-2" onClick={handleInstall}>
        <Download className="h-4 w-4" />
        {t.install}
      </Button>
      {showHint && <p className="text-xs text-muted-foreground">{t.unavailable}</p>}
    </div>
  );
}

