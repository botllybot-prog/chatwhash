import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, BellDot, CheckCheck } from "lucide-react";
import { useAppLanguage } from "@/lib/language";

interface Notification {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  type: string;
}

const texts = {
  ar: { title: "?????????", markAll: "????? ???? ??????", empty: "?? ???? ???????", now: "????", minutesAgo: "??? {count} ?????", hoursAgo: "??? {count} ????" },
  en: { title: "Notifications", markAll: "Mark all as read", empty: "No notifications", now: "Now", minutesAgo: "{count} min ago", hoursAgo: "{count} hr ago" },
  ku: { title: "?????????????????", markAll: "???????? ??? ????????? ????? ???", empty: "??? ????????????????? ????", now: "?????", minutesAgo: "?? ??? {count} ?????", hoursAgo: "?? ??? {count} ???????" },
  tr: { title: "Bildirimler", markAll: "Tümünü okundu isaretle", empty: "Bildirim yok", now: "Simdi", minutesAgo: "{count} dk önce", hoursAgo: "{count} sa önce" },
} as const;

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const { language, isRtl, locale } = useAppLanguage();
  const t = texts[language];

  const load = async () => {
    const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(30);
    if (data) setNotifications(data as Notification[]);
  };

  useEffect(() => {
    load();
    const channel = supabase.channel("notif-bell").on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => load()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const markOneRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return t.now;
    if (diff < 3600) return t.minutesAgo.replace("{count}", String(Math.floor(diff / 60)));
    if (diff < 86400) return t.hoursAgo.replace("{count}", String(Math.floor(diff / 3600)));
    return d.toLocaleDateString(locale);
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) load(); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          {unreadCount > 0 ? <BellDot className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
          {unreadCount > 0 && <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] font-bold leading-none">{unreadCount > 99 ? "99+" : unreadCount}</Badge>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" dir={isRtl ? "rtl" : "ltr"}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold text-sm">{t.title}</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
              <CheckCheck className="h-3.5 w-3.5 ml-1" />
              {t.markAll}
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">{t.empty}</div>
          ) : (
            notifications.map((n) => (
              <div key={n.id} onClick={() => markOneRead(n.id)} className={`px-4 py-3 border-b cursor-pointer hover:bg-muted/50 transition-colors ${!n.is_read ? "bg-primary/5" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                  </div>
                  {!n.is_read && <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">{formatTime(n.created_at)}</p>
              </div>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
