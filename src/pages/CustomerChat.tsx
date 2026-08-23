import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowRight, ImagePlus, Loader2, MessageCircle, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getCustomerSession } from "@/lib/customerSession";
import { CHAT_MEDIA_ACCEPT, uploadChatMedia } from "@/lib/chatMedia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useAppLanguage } from "@/lib/language";

const POLL_INTERVAL_MS = 5000;

type ThreadSummary = {
  id: string;
  kind: "direct" | "group";
  station_id: string | null;
  title: string;
  last_message_at: string | null;
  unread_count: number;
};

type ChatMessage = {
  id: string;
  thread_id: string;
  sender_type: "customer" | "owner" | "admin";
  sender_id: string;
  sender_name: string | null;
  body: string | null;
  media_key: string | null;
  media_url: string | null;
  media_type: string | null;
  media_name: string | null;
  created_at: string;
};

const texts = {
  ar: {
    title: "المحادثات",
    empty: "لا توجد محادثات بعد",
    emptyHint: "افتح محطة من قائمة المحطات واضغط \"محادثة\" لبدء أول رسالة.",
    placeholder: "اكتب رسالة...",
    send: "إرسال",
    back: "رجوع",
    newChat: "محادثة جديدة",
    loginRequired: "سجل الدخول للمتابعة",
    sendFailed: "تعذر إرسال الرسالة",
    uploadFailed: "تعذر إرسال الملف",
    unsupportedFile: "نوع الملف غير مدعوم",
  },
  en: {
    title: "Chats",
    empty: "No conversations yet",
    emptyHint: "Open a station from the stations list and tap \"Chat\" to send your first message.",
    placeholder: "Type a message...",
    send: "Send",
    back: "Back",
    newChat: "New chat",
    loginRequired: "Log in to continue",
    sendFailed: "Could not send the message",
    uploadFailed: "Could not send the file",
    unsupportedFile: "Unsupported file type",
  },
  ku: {
    title: "گفتوگۆکان",
    empty: "هیچ گفتوگۆیەک نییە",
    emptyHint: "وێستگەیەک لە لیستی وێستگەکان بکەرەوە و \"گفتوگۆ\" دابگرە بۆ ناردنی یەکەم نامە.",
    placeholder: "نامەیەک بنووسە...",
    send: "ناردن",
    back: "گەڕانەوە",
    newChat: "گفتوگۆی نوێ",
    loginRequired: "بچۆرە ژوورەوە بۆ بەردەوامبوون",
    sendFailed: "نامەکە نەنێردرا",
    uploadFailed: "فایلەکە نەنێردرا",
    unsupportedFile: "جۆری فایل پشتگیری ناکرێت",
  },
  tr: {
    title: "Sohbetler",
    empty: "Henüz konuşma yok",
    emptyHint: "İstasyon listesinden bir istasyon açın ve ilk mesajı göndermek için \"Sohbet\"e dokunun.",
    placeholder: "Bir mesaj yazın...",
    send: "Gönder",
    back: "Geri",
    newChat: "Yeni sohbet",
    loginRequired: "Devam etmek için giriş yapın",
    sendFailed: "Mesaj gönderilemedi",
    uploadFailed: "Dosya gönderilemedi",
    unsupportedFile: "Desteklenmeyen dosya türü",
  },
} as const;

const CustomerChat = () => {
  const { language, isRtl } = useAppLanguage();
  const t = texts[language];
  const [searchParams, setSearchParams] = useSearchParams();
  const session = getCustomerSession();

  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [composerText, setComposerText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const pendingStationId = searchParams.get("station_id");

  const loadThreads = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase.functions.invoke("customer-list-chat-threads", {
      body: { customer_phone: session.customerPhone, session_token: session.sessionToken },
    });
    if (data?.threads) setThreads(data.threads);
    setThreadsLoading(false);
  }, [session]);

  const loadMessages = useCallback(
    async (threadId: string) => {
      if (!session) return;
      const { data } = await supabase.functions.invoke("customer-get-chat-messages", {
        body: { customer_phone: session.customerPhone, session_token: session.sessionToken, thread_id: threadId },
      });
      if (data?.messages) setMessages(data.messages);
    },
    [session],
  );

  useEffect(() => {
    if (!session) return;
    loadThreads();
    const interval = setInterval(loadThreads, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [session, loadThreads]);

  useEffect(() => {
    if (!activeThreadId) return;
    loadMessages(activeThreadId);
    const interval = setInterval(() => loadMessages(activeThreadId), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [activeThreadId, loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Arriving with ?station_id= from "chat with station": jump straight into
  // an existing direct thread once threads finish loading. If none exists
  // yet, stay in "new chat" composer mode -- the thread is created lazily on
  // first send (see postMessage).
  useEffect(() => {
    if (!pendingStationId || threadsLoading) return;
    const existing = threads.find((thread) => thread.station_id === pendingStationId);
    if (existing) {
      setActiveThreadId(existing.id);
      setSearchParams({}, { replace: true });
    }
  }, [pendingStationId, threads, threadsLoading, setSearchParams]);

  const activeThread = threads.find((thread) => thread.id === activeThreadId) || null;
  const composingNewStationChat = !activeThreadId && !!pendingStationId;

  const postMessage = useCallback(
    async (params: {
      threadId?: string;
      stationId?: string;
      body?: string;
      media?: { key: string; url: string; type: string; name: string };
    }) => {
      if (!session) throw new Error(t.loginRequired);
      const { data, error } = await supabase.functions.invoke("customer-send-chat-message", {
        body: {
          customer_phone: session.customerPhone,
          session_token: session.sessionToken,
          thread_id: params.threadId,
          station_id: params.threadId ? undefined : params.stationId,
          body: params.body,
          media_key: params.media?.key,
          media_url: params.media?.url,
          media_type: params.media?.type,
          media_name: params.media?.name,
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || t.sendFailed);
      return data as { thread_id: string; message: ChatMessage };
    },
    [session, t.loginRequired, t.sendFailed],
  );

  const handleSendText = async () => {
    const trimmed = composerText.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      const result = await postMessage({
        threadId: activeThreadId || undefined,
        stationId: activeThreadId ? undefined : pendingStationId || undefined,
        body: trimmed,
      });
      setComposerText("");
      setMessages((prev) => [...prev, result.message]);
      if (!activeThreadId) {
        setActiveThreadId(result.thread_id);
        setSearchParams({}, { replace: true });
      }
      loadThreads();
    } catch (error) {
      toast({ title: t.sendFailed, description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleFilePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || uploading) return;

    setUploading(true);
    try {
      let threadId = activeThreadId;
      if (!threadId) {
        if (!pendingStationId) throw new Error(t.uploadFailed);
        // chat-media.ts checks per-thread membership, so a thread must exist
        // before uploading -- create it with a short placeholder message.
        const created = await postMessage({ stationId: pendingStationId, body: "👋" });
        threadId = created.thread_id;
        setActiveThreadId(threadId);
        setMessages((prev) => [...prev, created.message]);
        setSearchParams({}, { replace: true });
      }

      const uploaded = await uploadChatMedia(threadId, file);
      const result = await postMessage({ threadId, media: uploaded });
      setMessages((prev) => [...prev, result.message]);
      loadThreads();
    } catch (error) {
      toast({ title: t.uploadFailed, description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center" dir={isRtl ? "rtl" : "ltr"}>
        <p className="text-muted-foreground">{t.loginRequired}</p>
      </div>
    );
  }

  const showingThread = !!activeThreadId || composingNewStationChat;

  return (
    <div className="flex min-h-screen flex-col bg-background" dir={isRtl ? "rtl" : "ltr"}>
      <div className="sticky top-0 z-40 flex items-center gap-2 border-b border-border bg-card/95 px-4 py-4 backdrop-blur-xl">
        {showingThread ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setActiveThreadId(null);
                setSearchParams({}, { replace: true });
              }}
            >
              <ArrowRight className={`h-5 w-5 ${isRtl ? "" : "rotate-180"}`} />
            </Button>
            <h1 className="truncate text-lg font-bold text-foreground">{activeThread?.title || t.newChat}</h1>
          </>
        ) : (
          <h1 className="text-xl font-black text-foreground">{t.title}</h1>
        )}
      </div>

      {!showingThread ? (
        <div className="flex-1 space-y-2 px-4 py-4">
          {threadsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : threads.length === 0 ? (
            <div className="py-16 text-center">
              <MessageCircle className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
              <p className="mb-1 text-muted-foreground">{t.empty}</p>
              <p className="text-xs text-muted-foreground/70">{t.emptyHint}</p>
            </div>
          ) : (
            threads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => setActiveThreadId(thread.id)}
                className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-3 text-right shadow-sm transition-transform active:scale-[0.98]"
              >
                <span className="flex items-center gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ocean-100 text-ocean-600">
                    <MessageCircle className="h-5 w-5" />
                  </span>
                  <span className="truncate text-sm font-semibold text-foreground">{thread.title}</span>
                </span>
                {thread.unread_count > 0 && (
                  <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px] font-bold">
                    {thread.unread_count > 99 ? "99+" : thread.unread_count}
                  </Badge>
                )}
              </button>
            ))
          )}
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
            {messages.map((message) => {
              // sender_id rather than sender_type=="customer" so that, in a
              // group thread with multiple customers, another customer's
              // message isn't shown as "mine" just because it's a customer.
              const mine = message.sender_id === session.customerPhone;
              return (
                <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                      mine ? "bg-ocean-500 text-white" : "bg-muted text-foreground"
                    }`}
                  >
                    {!mine && message.sender_name && (
                      <p className="mb-0.5 text-xs font-semibold opacity-70">{message.sender_name}</p>
                    )}
                    {message.media_url && message.media_type?.startsWith("image/") && (
                      <img src={message.media_url} alt={message.media_name || ""} className="mb-1 max-h-64 rounded-lg" />
                    )}
                    {message.media_url && message.media_type?.startsWith("video/") && (
                      <video src={message.media_url} controls className="mb-1 max-h-64 rounded-lg" />
                    )}
                    {message.body && <p className="whitespace-pre-wrap">{message.body}</p>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="sticky bottom-0 flex items-center gap-2 border-t border-border bg-card/95 p-3 backdrop-blur-xl">
            <input ref={fileInputRef} type="file" accept={CHAT_MEDIA_ACCEPT} className="hidden" onChange={handleFilePick} />
            <Button variant="ghost" size="icon" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            </Button>
            <Input
              value={composerText}
              onChange={(event) => setComposerText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSendText();
                }
              }}
              placeholder={t.placeholder}
              className="flex-1"
            />
            <Button size="icon" disabled={sending || !composerText.trim()} onClick={handleSendText}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`} />}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default CustomerChat;
