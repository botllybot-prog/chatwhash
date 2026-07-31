import { useEffect, useState } from "react";
import { ExternalLink, Image as ImageIcon, Trash2, Video } from "lucide-react";
import { formatMediaSize, getOfferMediaKind } from "@/lib/offerMedia";

type OfferMediaPreviewProps = {
  file: File | null;
  mediaUrl: string | null;
  mediaType: string | null;
  fileName: string;
  label: string;
  kindLabels?: { image: string; video: string };
  statusLabels?: { pending: string; stored: string };
  emptyLabel?: string;
  removeLabel?: string;
  onRemove?: () => void;
};

const OfferMediaPreview = ({
  file,
  mediaUrl,
  mediaType,
  fileName,
  label,
  kindLabels,
  statusLabels,
  emptyLabel,
  removeLabel,
  onRemove,
}: OfferMediaPreviewProps) => {
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
  const previewName = file?.name || fileName;
  // A pending file never inherits the stored media type, which may be a
  // different kind entirely when the file is a replacement.
  const kind = getOfferMediaKind(file ? file.type : mediaType, previewName);
  const status = file ? statusLabels?.pending : statusLabels?.stored;

  if (!previewUrl) {
    if (!emptyLabel) return null;
    return (
      <div className="space-y-2 md:col-span-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <div className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 md:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <div className="flex items-center gap-3">
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
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex items-center gap-1 text-xs font-medium text-destructive hover:underline"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {removeLabel}
            </button>
          )}
        </div>
      </div>
      <div className="relative overflow-hidden rounded-xl border border-border/80 bg-muted/30 shadow-sm">
        <div className="absolute start-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-background/90 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur">
          {kind === "video" ? <Video className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
          <span className="max-w-52 truncate">{previewName}</span>
        </div>
        {kind === "video" ? (
          <video
            src={previewUrl}
            controls
            preload="metadata"
            className="max-h-80 w-full bg-slate-950 object-contain"
          />
        ) : kind === "image" ? (
          <img
            src={previewUrl}
            alt={previewName || label}
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
            {previewName}
          </a>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {kind && kindLabels && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
            {kind === "video" ? kindLabels.video : kindLabels.image}
          </span>
        )}
        {file ? <span>{formatMediaSize(file.size)}</span> : null}
        {status ? <span>{status}</span> : null}
      </div>
    </div>
  );
};

export default OfferMediaPreview;
