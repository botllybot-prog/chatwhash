import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Home, List, Map, MoreHorizontal, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const tabs = [
  { key: "/", icon: Home, label: "الرئيسية" },
  { key: "/stations-list", icon: List, label: "المحطات" },
  { key: "__whatsapp__", icon: MessageCircle, label: "واتساب" },
  { key: "/map", icon: Map, label: "الخريطة" },
  { key: "/more", icon: MoreHorizontal, label: "المزيد" },
];

const MobileLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [whatsappNumber, setWhatsappNumber] = useState("");

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
    <div className="min-h-screen bg-background pb-20" dir="rtl">
      <Outlet />

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
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
                  <div className="w-14 h-14 rounded-full bg-ocean-500 flex items-center justify-center shadow-lg shadow-ocean-500/40 active:scale-95 transition-transform">
                    <MessageCircle className="h-6 w-6 text-white" />
                  </div>
                  <span className="text-[10px] font-medium text-ocean-500 mt-1">{tab.label}</span>
                </button>
              );
            }

            return (
              <button
                key={tab.key}
                onClick={() => handleTabClick(tab.key)}
                className="flex flex-col items-center gap-0.5 min-w-[56px] active:scale-95 transition-transform"
              >
                <tab.icon
                  className={cn(
                    "h-5 w-5 transition-colors",
                    active ? "text-ocean-500" : "text-muted-foreground"
                  )}
                />
                <span
                  className={cn(
                    "text-[10px] font-medium transition-colors",
                    active ? "text-ocean-500" : "text-muted-foreground"
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
