import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Home, List, Map, MoreHorizontal } from "lucide-react";
import { useAppLanguage } from "@/lib/language";
import { cn } from "@/lib/utils";

const tabTranslations = {
  ar: { home: "الرئيسية", map: "الخريطة", stations: "المحطات", more: "المزيد" },
  en: { home: "Home", map: "Map", stations: "Stations", more: "More" },
  ku: { home: "سەرەکی", map: "نەخشە", stations: "وێستگەکان", more: "زیاتر" },
  tr: { home: "Ana sayfa", map: "Harita", stations: "İstasyonlar", more: "Daha fazla" },
} as const;

const MobileLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { language, isRtl } = useAppLanguage();

  const labels = tabTranslations[language];
  const tabs = [
    { key: "/", icon: Home, label: labels.home },
    { key: "/map", icon: Map, label: labels.map },
    { key: "/stations-list", icon: List, label: labels.stations },
    { key: "/more", icon: MoreHorizontal, label: labels.more },
  ];

  const isActive = (key: string) => {
    if (key === "/") return location.pathname === "/";
    if (key === "/more") return location.pathname === "/more" || location.pathname === "/privacy-policy";
    return location.pathname.startsWith(key);
  };

  return (
    <div className="min-h-screen bg-background pb-20" dir={isRtl ? "rtl" : "ltr"}>
      <Outlet />

      <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-card/95 backdrop-blur-xl safe-area-bottom">
        <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-2">
          {tabs.map((tab) => {
            const active = isActive(tab.key);

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => navigate(tab.key)}
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
