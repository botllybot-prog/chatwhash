import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Home, List, Map, MoreHorizontal, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAppLanguage } from "@/lib/language";
import { cn } from "@/lib/utils";

const tabTranslations = {
  ar: { home: "الرئيسية", stations: "المحطات", whatsapp: "واتساب", map: "الخريطة", more: "المزيد" },
  en: { home: "Home", stations: "Stations", whatsapp: "WhatsApp", map: "Map", more: "More" },
  ku: { home: "سەرەکی", stations: "وێستگەکان", whatsapp: "واتساپ", map: "نەخشە", more: "زیاتر" },
  tr: { home: "Ana sayfa", stations: "İstasyonlar", whatsapp: "WhatsApp", map: "Harita", more: "Daha fazla" },
} as const;

const MobileLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const { language, isRtl } = useAppLanguage();

  const labels = tabTranslations[language];
  const tabs = [
    { key: "/", icon: Home, label: labels.home },
    { key: "/stations-list", icon: List, label: labels.stations },
    { key: "__whatsapp__", icon: MessageCircle, label: labels.whatsapp },
    { key: "/map", icon: Map, label: labels.map },
    { key: "/more", icon: MoreHorizontal, label: labels.more },
  ];

  useEffect(() => {
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "WHATSAPP_BOT_NUMBER")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setWhatsappNumber(data.value);
      });
  }, []);

  const handleTabClick = (key: string) => {
    if (key === "__whatsapp__") {
      const num = whatsappNumber.replace(/[^0-9]/g, "");
      window.open(`https://wa.me/${num}`, "_blank");
      return;
    }
    navigate(key);
  };

  const isActive = (key: string) => {
    if (key === "__whatsapp__") return false;
    if (key === "/") return location.pathname === "/";
    return location.pathname.startsWith(key);
  };

  return (
    <div className="min-h-screen bg-background pb-20" dir={isRtl ? "rtl" : "ltr"}>
      <Outlet />

      <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-card/95 backdrop-blur-xl safe-area-bottom">
        <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-2">
          {tabs.map((tab) => {
            const active = isActive(tab.key);
            const isWhatsapp = tab.key === "__whatsapp__";

            if (isWhatsapp) {
              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabClick(tab.key)}
                  className="relative -mt-6 flex flex-col items-center"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ocean-500 shadow-lg shadow-ocean-500/40 transition-transform active:scale-95">
                    <MessageCircle className="h-6 w-6 text-white" />
                  </div>
                  <span className="mt-1 text-[10px] font-medium text-ocean-500">{tab.label}</span>
                </button>
              );
            }

            return (
              <button
                key={tab.key}
                onClick={() => handleTabClick(tab.key)}
                className="flex min-w-[56px] flex-col items-center gap-0.5 transition-transform active:scale-95"
              >
                <tab.icon
                  className={cn(
                    "h-5 w-5 transition-colors",
                    active ? "text-ocean-500" : "text-muted-foreground",
                  )}
                />
                <span
                  className={cn(
                    "text-[10px] font-medium transition-colors",
                    active ? "text-ocean-500" : "text-muted-foreground",
                  )}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default MobileLayout;
