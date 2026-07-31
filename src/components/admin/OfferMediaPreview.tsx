import { useEffect, useState } from "react";
import { ExternalLink, Image as ImageIcon, Video } from "lucide-react";

type OfferMediaPreviewProps = {
  file: File | null;
  mediaUrl: string | null;
  mediaType: string | null;
  fileName: string;
  label: string;
};

const OfferMediaPreview = ({ file, mediaUrl, mediaType, fileName, label }: OfferMediaPreviewProps) => {
  const [localUrl, setLocalUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setLocalUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setLocalUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const previewUrl = localUrl || mediaUrl;
  const previewType = file?.type || mediaType || "";
  if (!previewUrl) return null;

  const isVideo = previewType.startsWith("video/");
  const isImage = previewType.startsWith("image/");

  return (
    <div className="space-y-2 md:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {!file && mediaUrl && (
          <a
            href={mediaUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {fileName}
          </a>
        )}
      </div>
      <div className="relative overflow-hidden rounded-xl border border-border/80 bg-muted/30 shadow-sm">
        <div className="absolute start-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-background/90 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur">
          {isVideo ? <Video className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
          <span className="max-w-52 truncate">{fileName}</span>
        </div>
        {isVideo ? (
          <video
            src={previewUrl}
            controls
            preload="metadata"
            className="max-h-80 w-full bg-slate-950 object-contain"
          />
        ) : isImage ? (
          <img
            src={previewUrl}
            alt={fileName || label}
            className="max-h-80 w-full bg-muted/20 object-contain"
          />
        ) : (
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-32 items-center justify-center gap-2 p-6 text-sm font-medium text-primary hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            {fileName}
          </a>
        )}
      </div>
    </div>
  );
};

export default OfferMediaPreview;
