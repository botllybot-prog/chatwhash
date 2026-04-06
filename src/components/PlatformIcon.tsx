import { MessageCircle, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlatformIconProps {
  platform?: string;
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
}

const PlatformIcon = ({ platform = "whatsapp", size = "sm", showLabel = false, className }: PlatformIconProps) => {
  const isWhatsApp = platform === "whatsapp";
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {isWhatsApp ? (
        <MessageCircle className={cn(iconSize, "text-green-500")} />
      ) : (
        <Send className={cn(iconSize, "text-blue-500")} />
      )}
      {showLabel && (
        <span className={cn("text-[10px]", isWhatsApp ? "text-green-600" : "text-blue-600")}>
          {isWhatsApp ? "واتساب" : "تليغرام"}
        </span>
      )}
    </span>
  );
};

export default PlatformIcon;
