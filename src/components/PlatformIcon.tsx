import { MessageCircle, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppLanguage } from "@/lib/language";

interface PlatformIconProps {
  platform?: string;
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
}

const labels = {
  ar: { whatsapp: "??????", telegram: "????????" },
  en: { whatsapp: "WhatsApp", telegram: "Telegram" },
  ku: { whatsapp: "??????", telegram: "????????" },
  tr: { whatsapp: "WhatsApp", telegram: "Telegram" },
} as const;

const PlatformIcon = ({ platform = "whatsapp", size = "sm", showLabel = false, className }: PlatformIconProps) => {
  const isWhatsApp = platform === "whatsapp";
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const { language } = useAppLanguage();
  const t = labels[language];

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {isWhatsApp ? <MessageCircle className={cn(iconSize, "text-green-500")} /> : <Send className={cn(iconSize, "text-blue-500")} />}
      {showLabel && <span className={cn("text-[10px]", isWhatsApp ? "text-green-600" : "text-blue-600")}>{isWhatsApp ? t.whatsapp : t.telegram}</span>}
    </span>
  );
};

export default PlatformIcon;
