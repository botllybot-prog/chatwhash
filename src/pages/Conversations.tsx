import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Settings, Send, MessageCircle, Check, CheckCheck, User, LogOut, Volume2, VolumeX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useNotificationSound } from "@/hooks/use-notification-sound";
import type { Tables } from "@/integrations/supabase/types";

type Conversation = Tables<"conversations">;
type Message = Tables<"messages">;

const StatusIcon = ({ status }: { status: string }) => {
  if (status === "read") return <CheckCheck className="h-3.5 w-3.5 text-blue-500" />;
  if (status === "delivered") return <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />;
  if (status === "sent") return <Check className="h-3.5 w-3.5 text-muted-foreground" />;
  return null;
};

const formatTime = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
};

const Conversations = () => {
  const navigate = useNavigate();
  const playNotification = useNotificationSound();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const soundEnabledRef = useRef(true);

  const loadConversations = useCallback(async () => {
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .order("last_message_at", { ascending: false });
    if (data) setConversations(data);
  }, []);

  // Keep ref in sync with state for use in realtime callbacks
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  // Load conversations + realtime
  useEffect(() => {
    loadConversations();

    const channel = supabase
      .channel("conv-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        loadConversations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadConversations]);

  // Global listener for inbound message notifications
  useEffect(() => {
    const channel = supabase
      .channel("inbound-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as Message;
          if (msg.direction === "inbound" && soundEnabledRef.current) {
            playNotification();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playNotification]);

  // Load messages for selected conversation + realtime
  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", selectedId)
        .order("created_at", { ascending: true });
      if (data) setMessages(data);
    };
    loadMessages();

    // Clean up previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channelName = `msgs-${selectedId}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${selectedId}` },
        () => { loadMessages(); }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current === channel) {
        supabase.removeChannel(channel);
        channelRef.current = null;
      }
    };
  }, [selectedId]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectedConv = conversations.find((c) => c.id === selectedId);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedConv) return;
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-send", {
        body: {
          conversation_id: selectedConv.id,
          to: selectedConv.customer_phone,
          message: newMessage.trim(),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setNewMessage("");
    } catch (e: any) {
      console.error(e);
      toast({ title: "خطأ في الإرسال", description: e.message || "فشل في إرسال الرسالة", variant: "destructive" });
    }
    setSending(false);
  };

  return (
    <div className="h-screen flex bg-background" dir="rtl">
      {/* Sidebar */}
      <div className="w-80 border-l border-border flex flex-col bg-card">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            <h2 className="font-bold text-foreground">المحادثات</h2>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setSoundEnabled(!soundEnabled)} title={soundEnabled ? "كتم الصوت" : "تفعيل الصوت"}>
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => supabase.auth.signOut()}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <p className="text-center text-muted-foreground p-6 text-sm">لا توجد محادثات بعد</p>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedId(conv.id)}
                className={cn(
                  "w-full p-4 text-right border-b border-border hover:bg-accent transition-colors",
                  selectedId === conv.id && "bg-accent"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {conv.customer_name || conv.customer_phone}
                    </p>
                    <p className="text-xs text-muted-foreground">{conv.customer_phone}</p>
                  </div>
                  {conv.last_message_at && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatTime(conv.last_message_at)}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {selectedConv ? (
          <>
            <div className="p-4 border-b border-border bg-card flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-bold text-foreground">
                  {selectedConv.customer_name || selectedConv.customer_phone}
                </p>
                <p className="text-xs text-muted-foreground">{selectedConv.customer_phone}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/30">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm",
                    msg.direction === "outbound"
                      ? "mr-auto bg-primary text-primary-foreground rounded-bl-md"
                      : "ml-auto bg-card text-card-foreground border border-border rounded-br-md"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <div className={cn(
                    "flex items-center gap-1 mt-1",
                    msg.direction === "outbound" ? "justify-start" : "justify-end"
                  )}>
                    <span className="text-[10px] opacity-70">{formatTime(msg.created_at)}</span>
                    {msg.direction === "outbound" && <StatusIcon status={msg.status} />}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-border bg-card">
              <div className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="اكتب رسالتك..."
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  disabled={sending}
                />
                <Button onClick={handleSend} disabled={sending || !newMessage.trim()} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-3">
              <MessageCircle className="h-16 w-16 mx-auto opacity-30" />
              <p className="text-lg">اختر محادثة للبدء</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Conversations;
