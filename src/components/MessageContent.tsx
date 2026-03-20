import { Image, Mic, FileText, Video, Sticker, MapPin, UserRound, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageContentProps {
  content: string;
  messageType: string;
  direction: string;
  mediaUrl?: string | null;
}

const MessageContent = ({ content, messageType, direction, mediaUrl }: MessageContentProps) => {
  const isOutbound = direction === "outbound";
  const iconColor = isOutbound ? "text-primary-foreground/70" : "text-muted-foreground";

  // Text messages - plain render
  if (messageType === "text") {
    return <p className="text-sm whitespace-pre-wrap">{content}</p>;
  }

  // Image with actual media
  if (messageType === "image" && mediaUrl) {
    return (
      <div className="space-y-1.5">
        <img
          src={mediaUrl}
          alt={content || "صورة"}
          className="rounded-lg max-w-full max-h-64 object-contain cursor-pointer"
          onClick={() => window.open(mediaUrl, "_blank")}
          loading="lazy"
        />
        {content && content !== "📷 صورة" && (
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        )}
      </div>
    );
  }

  // Video with actual media
  if (messageType === "video" && mediaUrl) {
    return (
      <div className="space-y-1.5">
        <video
          src={mediaUrl}
          controls
          className="rounded-lg max-w-full max-h-64"
          preload="metadata"
        />
        {content && content !== "🎥 فيديو" && (
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        )}
      </div>
    );
  }

  // Audio with actual media
  if (messageType === "audio" && mediaUrl) {
    return (
      <div className="flex items-center gap-2">
        <Mic className={cn("h-4 w-4 shrink-0", iconColor)} />
        <audio src={mediaUrl} controls className="max-w-[240px] h-8" preload="metadata" />
      </div>
    );
  }

  // Document with download link
  if (messageType === "document" && mediaUrl) {
    return (
      <a
        href={mediaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
          isOutbound
            ? "bg-primary-foreground/10 hover:bg-primary-foreground/20"
            : "bg-muted hover:bg-muted/80"
        )}
      >
        <FileText className={cn("h-5 w-5 shrink-0", iconColor)} />
        <span className="text-sm flex-1 truncate">{content}</span>
        <Download className={cn("h-4 w-4 shrink-0", iconColor)} />
      </a>
    );
  }

  // Sticker with actual media
  if (messageType === "sticker" && mediaUrl) {
    return (
      <img
        src={mediaUrl}
        alt="ملصق"
        className="max-w-[128px] max-h-[128px]"
        loading="lazy"
      />
    );
  }

  // Fallback: icon + text for any type without media
  const icons: Record<string, React.ElementType> = {
    image: Image, audio: Mic, video: Video, document: FileText,
    sticker: Sticker, location: MapPin, contacts: UserRound,
  };
  const Icon = icons[messageType];

  if (Icon) {
    return (
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4 shrink-0", iconColor)} />
        <p className="text-sm whitespace-pre-wrap">{content}</p>
      </div>
    );
  }

  return <p className="text-sm whitespace-pre-wrap">{content}</p>;
};

export default MessageContent;
