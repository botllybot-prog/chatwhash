import { useState, useEffect, useRef, useCallback } from "react";
import MessageContent from "@/components/MessageContent";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Settings, Send, MessageCircle, Check, CheckCheck, User, LogOut, Volume2, VolumeX, Bot } from "lucide-react";
import PlatformIcon from "@/components/PlatformIcon";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useNotificationSound } from "@/hooks/use-notification-sound";
import type { Tables } from "@/integrations/supabase/types";
import { useAppLanguage } from "@/lib/language";

type Conversation = Tables<"conversations">;
type Message = Tables<"messages">;

const texts = {
  ar: { title: "?????????", mute: "??? ?????", enableSound: "????? ?????", dashboard: "???? ??????", noConversations: "?? ???? ??????? ???", sendErrorTitle: "??? ?? ???????", sendErrorDescription: "??? ?? ????? ???????", placeholder: "???? ??????...", select: "???? ?????? ?????" },
  en: { title: "Conversations", mute: "Mute sound", enableSound: "Enable sound", dashboard: "Dashboard", noConversations: "No conversations yet", sendErrorTitle: "Send failed", sendErrorDescription: "Failed to send the message", placeholder: "Type your message...", select: "Choose a conversation to start" },
  ku: { title: "?????????", mute: "??????????? ????", enableSound: "?????????? ????", dashboard: "???????", noConversations: "????? ??? ????????? ????", sendErrorTitle: "????? ????????? ?????", sendErrorDescription: "?????? ???????? ????? ????", placeholder: "????????? ??????...", select: "????????? ???????? ?? ??????????" },
  tr: { title: "Görüsmeler", mute: "Sesi kapat", enableSound: "Sesi aç", dashboard: "Panel", noConversations: "Henüz görüsme yok", sendErrorTitle: "Gönderim basarisiz", sendErrorDescription: "Mesaj gönderilemedi", placeholder: "Mesajinizi yazin...", select: "Baslamak için bir görüsme seçin" },
} as const;

const StatusIcon = ({ status }: { status: string }) => {
  if (status === "read") return <CheckCheck className="h-3.5 w-3.5 text-blue-500" />;
  if (status === "delivered") return <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />;
  if (status === "sent") return <Check className="h-3.5 w-3.5 text-muted-foreground" />;
  return null;
};

const Conversations = () => {
  const navigate = useNavigate();
  const playNotification = useNotificationSound();
  const { language, isRtl, locale } = useAppLanguage();
  const t = texts[language];
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const soundEnabledRef = useRef(true);

  const formatTime = useCallback((dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }, [locale]);

  const loadConversations = useCallback(async () => {
    const { data } = await supabase.from("conversations").select("*").order("last_message_at", { ascending: false });
    if (data) setConversations(data);
  }, []);

  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

  useEffect(() => {
    loadConversations();
    const channel = supabase.channel("conv-list").on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => { loadConversations(); }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadConversations]);

  useEffect(() => {
    const channel = supabase.channel("inbound-notifications").on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
      const msg = payload.new as Message;
      if (msg.direction === "inbound" && soundEnabledRef.current) playNotification();
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [playNotification]);

  useEffect(() => {
    if (!selectedId) { setMessages([]); return; }
    const loadMessages = async () => {
      const { data } = await supabase.from("messages").select("*").eq("conversation_id", selectedId).order("created_at", { ascending: true });
      if (data) setMessages(data);
    };
    loadMessages();
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    const channel = supabase.channel(`msgs-${selectedId}-${Date.now()}`).on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${selectedId}` }, () => { loadMessages(); }).subscribe();
    channelRef.current = channel;
    return () => {
      if (channelRef.current === channel) {
        supabase.removeChannel(channel);
        channelRef.current = null;
      }
    };
  }, [selectedId]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const selectedConv = conversations.find((c) => c.id === selectedId);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedConv) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-send", { body: { conversation_id: selectedConv.id, to: selectedConv.customer_phone, message: newMessage.trim() } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setNewMessage("");
    } catch (e: any) {
      toast({ title: t.sendErrorTitle, description: e.message || t.sendErrorDescription, variant: "destructive" });
    }
    setSending(false);
  };

  return (
    <div className="h-screen flex bg-background" dir={isRtl ? "rtl" : "ltr"}>
      <div className="w-80 border-l border-border flex flex-col bg-card">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-primary" /><h2 className="font-bold text-foreground">{t.title}</h2></div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setSoundEnabled(!soundEnabled)} title={soundEnabled ? t.mute : t.enableSound}>{soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</Button>
            <Button variant="ghost" size="icon" onClick={() => navigate("/app/admin/stations")} title={t.dashboard}><Bot className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => navigate("/app/admin/settings")}><Settings className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => supabase.auth.signOut()}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? <p className="text-center text-muted-foreground p-6 text-sm">{t.noConversations}</p> : conversations.map((conv) => (
            <button key={conv.id} onClick={() => setSelectedId(conv.id)} className={cn("w-full p-4 text-right border-b border-border hover:bg-accent transition-colors", selectedId === conv.id && "bg-accent")}>
              <div className="flex items-center gap-3">
                <div className="relative h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><User className="h-5 w-5 text-primary" /><span className="absolute -bottom-0.5 -left-0.5"><PlatformIcon platform={(conv as any).platform || "whatsapp"} size="sm" /></span></div>
                <div className="flex-1 min-w-0"><p className="font-medium text-foreground truncate">{conv.customer_name || conv.customer_phone}</p><p className="text-xs text-muted-foreground">{conv.customer_phone}</p></div>
                {conv.last_message_at && <span className="text-xs text-muted-foreground shrink-0">{formatTime(conv.last_message_at)}</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedConv ? (
          <>
            <div className="p-4 border-b border-border bg-card flex items-center gap-3">
              <div className="relative h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center"><User className="h-5 w-5 text-primary" /><span className="absolute -bottom-0.5 -left-0.5"><PlatformIcon platform={(selectedConv as any).platform || "whatsapp"} size="sm" /></span></div>
              <div><div className="flex items-center gap-2"><p className="font-bold text-foreground">{selectedConv.customer_name || selectedConv.customer_phone}</p><PlatformIcon platform={(selectedConv as any).platform || "whatsapp"} size="sm" showLabel /></div><p className="text-xs text-muted-foreground">{selectedConv.customer_phone}</p></div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/30">
              {messages.map((msg) => (
                <div key={msg.id} className={cn("max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm", msg.direction === "outbound" ? "mr-auto bg-primary text-primary-foreground rounded-bl-md" : "ml-auto bg-card text-card-foreground border border-border rounded-br-md")}>
                  <MessageContent content={msg.content} messageType={msg.message_type} direction={msg.direction} mediaUrl={(msg as any).media_url} />
                  <div className={cn("flex items-center gap-1 mt-1", msg.direction === "outbound" ? "justify-start" : "justify-end")}><span className="text-[10px] opacity-70">{formatTime(msg.created_at)}</span>{msg.direction === "outbound" && <StatusIcon status={msg.status} />}</div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-4 border-t border-border bg-card">
              <div className="flex gap-2">
                <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder={t.placeholder} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()} disabled={sending} />
                <Button onClick={handleSend} disabled={sending || !newMessage.trim()} size="icon"><Send className="h-4 w-4" /></Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground"><div className="text-center space-y-3"><MessageCircle className="h-16 w-16 mx-auto opacity-30" /><p className="text-lg">{t.select}</p></div></div>
        )}
      </div>
    </div>
  );
};

export default Conversations;
