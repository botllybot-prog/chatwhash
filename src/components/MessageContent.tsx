import { Image, Mic, FileText, Video, Sticker, MapPin, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageContentProps {
  content: string;
  messageType: string;
  direction: string;
}

const typeConfig: Record<string, { icon: React.ElementType; label: string }> = {
  image: { icon: Image, label: "صورة" },
  audio: { icon: Mic, label: "رسالة صوتية" },
  video: { icon: Video, label: "فيديو" },
  document: { icon: FileText, label: "مستند" },
  sticker: { icon: Sticker, label: "ملصق" },
  location: { icon: MapPin, label: "موقع" },
  contacts: { icon: UserRound, label: "جهة اتصال" },
};

const MessageContent = ({ content, messageType, direction }: MessageContentProps) => {
  if (messageType === "text" || !typeConfig[messageType]) {
    return <p className="text-sm whitespace-pre-wrap">{content}</p>;
  }

  const { icon: Icon } = typeConfig[messageType];
  const isOutbound = direction === "outbound";

  return (
    <div className="flex items-center gap-2">
      <Icon className={cn(
        "h-4 w-4 shrink-0",
        isOutbound ? "text-primary-foreground/70" : "text-muted-foreground"
      )} />
      <p className="text-sm whitespace-pre-wrap">{content}</p>
    </div>
  );
};

export default MessageContent;
