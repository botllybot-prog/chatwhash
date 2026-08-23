import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Search, Send, Users, MessageCircle, Ban, CheckCircle, Filter } from "lucide-react";
import { useAppLanguage } from "@/lib/language";

type BotCustomer = { id: string; phone: string; name: string | null; platform: string; first_seen_at: string; last_seen_at: string; total_bookings: number; last_booking_at: string | null; is_blocked: boolean; notes: string | null; };

const texts = {
  ar: { title: "عملاء البوت", bulk: "إرسال رسالة جماعية", total: "إجمالي العملاء", whatsapp: "واتساب", telegram: "تلقرام", withBookings: "لديهم حجوزات", search: "بحث بالهاتف أو الاسم...", all: "الكل", noCustomers: "لا يوجد عملاء بعد", name: "الاسم", phone: "الهاتف", platform: "المنصة", bookings: "الحجوزات", lastActivity: "آخر نشاط", status: "الحالة", actions: "إجراءات", blocked: "محظور", active: "نشط", sendMessage: "إرسال رسالة", unblock: "إلغاء الحظر", block: "حظر", singleTitle: "إرسال رسالة إلى", bulkTitle: "إرسال رسالة جماعية", text: "نص الرسالة", send: "إرسال", sending: "جاري الإرسال...", sentSuccess: "تم إرسال الرسالة بنجاح ✅", sentFail: "فشل إرسال الرسالة", blockDone: "تم حظر العميل", unblockDone: "تم إلغاء الحظر", genericError: "حدث خطأ", customersCount: "عميل", noName: "—", messageHere: "اكتب رسالتك هنا...", offerHere: "اكتب رسالتك / عرضك هنا...", sendTo: "سيتم الإرسال إلى", only: "فقط", sentSummary: "تم الإرسال", successWord: "نجح", failWord: "فشل", phoneLabel: "الهاتف", platformLabel: "المنصة", unknownDate: "—" },
  en: { title: "Bot customers", bulk: "Send broadcast", total: "Total customers", whatsapp: "WhatsApp", telegram: "Telegram", withBookings: "With bookings", search: "Search by phone or name...", all: "All", noCustomers: "No customers yet", name: "Name", phone: "Phone", platform: "Platform", bookings: "Bookings", lastActivity: "Last activity", status: "Status", actions: "Actions", blocked: "Blocked", active: "Active", sendMessage: "Send message", unblock: "Unblock", block: "Block", singleTitle: "Send message to", bulkTitle: "Send broadcast", text: "Message text", send: "Send", sending: "Sending...", sentSuccess: "Message sent successfully ✅", sentFail: "Message sending failed", blockDone: "Customer blocked", unblockDone: "Customer unblocked", genericError: "Something went wrong", customersCount: "customers", noName: "—", messageHere: "Write your message here...", offerHere: "Write your message / offer here...", sendTo: "Will be sent to", only: "only", sentSummary: "Sent", successWord: "success", failWord: "failed", phoneLabel: "Phone", platformLabel: "Platform", unknownDate: "—" },
  ku: { title: "کڕیارانی بۆت", bulk: "ناردنی پەیامی گشتی", total: "کۆی گشتی کڕیاران", whatsapp: "واتساپ", telegram: "تێلێگرام", withBookings: "خاوەن پاشەکەوت", search: "گەڕان بە ژمارە یان ناو...", all: "هەموو", noCustomers: "هێشتا کڕیار نییە", name: "ناو", phone: "ژمارە", platform: "پلاتفۆرم", bookings: "پاشەکەوتەکان", lastActivity: "دوایین چالاکی", status: "دۆخ", actions: "کردارەکان", blocked: "بلۆککراو", active: "چالاک", sendMessage: "ناردنی پەیام", unblock: "لابردنی بلۆک", block: "بلۆککردن", singleTitle: "ناردنی پەیام بۆ", bulkTitle: "ناردنی پەیامی گشتی", text: "دەقی پەیام", send: "ناردن", sending: "دەنێردرێت...", sentSuccess: "پەیامەکە بە سەرکەوتوویی نێردرا ✅", sentFail: "ناردنی پەیام سەرکەوتوو نەبوو", blockDone: "کڕیار بلۆک کرا", unblockDone: "بلۆکی کڕیار لابرا", genericError: "هەڵەیەک ڕوویدا", customersCount: "کڕیار", noName: "—", messageHere: "پەیامەکەت لێرە بنووسە...", offerHere: "پەیام / پێشکەشکراوەکەت لێرە بنووسە...", sendTo: "دەنێردرێت بۆ", only: "تەنها", sentSummary: "نێردرا", successWord: "سەرکەوتوو", failWord: "سەرنەکەوتوو", phoneLabel: "ژمارە", platformLabel: "پلاتفۆرم", unknownDate: "—" },
  tr: { title: "Bot müşterileri", bulk: "Toplu mesaj gönder", total: "Toplam müşteri", whatsapp: "WhatsApp", telegram: "Telegram", withBookings: "Rezervasyonlu", search: "Telefon veya ada göre ara...", all: "Tümü", noCustomers: "Henüz müşteri yok", name: "Ad", phone: "Telefon", platform: "Platform", bookings: "Rezervasyonlar", lastActivity: "Son etkinlik", status: "Durum", actions: "İşlemler", blocked: "Engelli", active: "Aktif", sendMessage: "Mesaj gönder", unblock: "Engeli kaldır", block: "Engelle", singleTitle: "Mesaj gönder:", bulkTitle: "Toplu mesaj gönder", text: "Mesaj metni", send: "Gönder", sending: "Gönderiliyor...", sentSuccess: "Mesaj başarıyla gönderildi ✅", sentFail: "Mesaj gönderilemedi", blockDone: "Müşteri engellendi", unblockDone: "Müşteri engeli kaldırıldı", genericError: "Bir hata oluştu", customersCount: "müşteri", noName: "—", messageHere: "Mesajınızı buraya yazın...", offerHere: "Mesajınızı / teklifinizi buraya yazın...", sendTo: "Şuraya gönderilecek", only: "yalnızca", sentSummary: "Gönderildi", successWord: "başarılı", failWord: "başarısız", phoneLabel: "Telefon", platformLabel: "Platform", unknownDate: "—" },
} as const;

const CustomersTab = () => {
  const [customers, setCustomers] = useState<BotCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<BotCustomer | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [stats, setStats] = useState({ total: 0, whatsapp: 0, telegram: 0, withBookings: 0 });
  const { language, isRtl, locale } = useAppLanguage();
  const t = texts[language];

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).from("bot_customers").select("*").order("last_seen_at", { ascending: false });
    if (data) {
      setCustomers(data);
      setStats({ total: data.length, whatsapp: data.filter((c: BotCustomer) => c.platform === "whatsapp").length, telegram: data.filter((c: BotCustomer) => c.platform === "telegram").length, withBookings: data.filter((c: BotCustomer) => c.total_bookings > 0).length });
    }
    if (error) console.error(error);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = customers.filter((c) => {
    const matchSearch = !search || c.phone.includes(search) || (c.name || "").includes(search);
    const matchPlatform = platformFilter === "all" || c.platform === platformFilter;
    return matchSearch && matchPlatform;
  });

  const formatDate = (d: string | null) => !d ? t.unknownDate : new Date(d).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  const handleSendMessage = async () => {
    if (!selectedCustomer || !message.trim()) return;
    setSending(true);
    try {
      if (selectedCustomer.platform === "whatsapp") {
        const { error } = await supabase.functions.invoke("whatsapp-send", { body: { phone: selectedCustomer.phone, message: message.trim() } });
        if (error) throw error;
      }
      toast({ title: t.sentSuccess });
      setMessage("");
      setSendDialogOpen(false);
    } catch (err: any) {
      toast({ title: t.sentFail, description: err?.message, variant: "destructive" });
    }
    setSending(false);
  };

  const handleBulkSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    const targets = filtered.filter((c) => !c.is_blocked);
    let sent = 0;
    let failed = 0;
    for (const c of targets) {
      try {
        if (c.platform === "whatsapp") {
          await supabase.functions.invoke("whatsapp-send", { body: { phone: c.phone, message: message.trim() } });
        }
        sent++;
      } catch {
        failed++;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    toast({ title: `${t.sentSummary}: ${sent} ${t.successWord}, ${failed} ${t.failWord}` });
    setMessage("");
    setBulkDialogOpen(false);
    setSending(false);
  };

  const toggleBlock = async (customer: BotCustomer) => {
    const { error } = await (supabase as any).from("bot_customers").update({ is_blocked: !customer.is_blocked }).eq("id", customer.id);
    if (error) {
      toast({ title: t.genericError, description: error.message, variant: "destructive" });
      return;
    }
    await load();
    toast({ title: customer.is_blocked ? t.unblockDone : t.blockDone });
  };

  if (loading) return <p className="text-muted-foreground text-center py-12">Loading...</p>;

  return (
    <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">{t.title}</h2>
        <Button onClick={() => { setMessage(""); setBulkDialogOpen(true); }}><Send className="h-4 w-4 ml-2" />{t.bulk} ({filtered.filter(c => !c.is_blocked).length})</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[{ icon: Users, value: stats.total, label: t.total, color: "text-primary" }, { icon: MessageCircle, value: stats.whatsapp, label: t.whatsapp, color: "text-green-600" }, { icon: MessageCircle, value: stats.telegram, label: t.telegram, color: "text-blue-500" }, { icon: CheckCircle, value: stats.withBookings, label: t.withBookings, color: "text-orange-500" }].map((item) => <Card key={item.label}><CardContent className="py-4 text-center"><item.icon className={`h-6 w-6 mx-auto mb-1 ${item.color}`} /><div className="text-2xl font-bold">{item.value}</div><div className="text-xs text-muted-foreground">{item.label}</div></CardContent></Card>)}
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]"><Search className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input placeholder={t.search} value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" /></div>
        <Select value={platformFilter} onValueChange={setPlatformFilter}><SelectTrigger className="w-40"><Filter className="h-4 w-4 ml-2" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t.all}</SelectItem><SelectItem value="whatsapp">{t.whatsapp}</SelectItem><SelectItem value="telegram">{t.telegram}</SelectItem></SelectContent></Select>
      </div>

      <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead className="text-right">{t.name}</TableHead><TableHead className="text-right">{t.phone}</TableHead><TableHead className="text-right">{t.platform}</TableHead><TableHead className="text-right">{t.bookings}</TableHead><TableHead className="text-right">{t.lastActivity}</TableHead><TableHead className="text-right">{t.status}</TableHead><TableHead className="text-right">{t.actions}</TableHead></TableRow></TableHeader><TableBody>{filtered.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{t.noCustomers}</TableCell></TableRow> : filtered.map((c) => <TableRow key={c.id} className={c.is_blocked ? "opacity-50" : ""}><TableCell className="font-medium">{c.name || t.noName}</TableCell><TableCell className="font-mono text-sm" dir="ltr">{c.phone}</TableCell><TableCell><Badge variant={c.platform === "whatsapp" ? "default" : "secondary"} className="text-xs">{c.platform === "whatsapp" ? t.whatsapp : t.telegram}</Badge></TableCell><TableCell className="text-center">{c.total_bookings}</TableCell><TableCell className="text-xs">{formatDate(c.last_seen_at)}</TableCell><TableCell>{c.is_blocked ? <Badge variant="destructive" className="text-xs">{t.blocked}</Badge> : <Badge variant="outline" className="text-xs text-green-600">{t.active}</Badge>}</TableCell><TableCell><div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => { setSelectedCustomer(c); setMessage(""); setSendDialogOpen(true); }} title={t.sendMessage}><Send className="h-3 w-3" /></Button><Button size="sm" variant={c.is_blocked ? "outline" : "destructive"} onClick={() => toggleBlock(c)} title={c.is_blocked ? t.unblock : t.block}>{c.is_blocked ? <CheckCircle className="h-3 w-3" /> : <Ban className="h-3 w-3" />}</Button></div></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>

      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}><DialogContent dir={isRtl ? "rtl" : "ltr"}><DialogHeader><DialogTitle>{t.singleTitle} {selectedCustomer?.name || selectedCustomer?.phone}</DialogTitle><DialogDescription className="sr-only">{t.sendMessage}</DialogDescription></DialogHeader><div className="space-y-4"><div className="text-sm text-muted-foreground">{t.platformLabel}: {selectedCustomer?.platform === "whatsapp" ? t.whatsapp : t.telegram} | {t.phoneLabel}: {selectedCustomer?.phone}</div><div className="space-y-2"><Label>{t.text}</Label><Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder={t.messageHere} /></div><Button onClick={handleSendMessage} disabled={sending || !message.trim()} className="w-full"><Send className="h-4 w-4 ml-2" />{sending ? t.sending : t.send}</Button></div></DialogContent></Dialog>

      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}><DialogContent dir={isRtl ? "rtl" : "ltr"}><DialogHeader><DialogTitle>{t.bulkTitle}</DialogTitle><DialogDescription className="sr-only">{t.bulk}</DialogDescription></DialogHeader><div className="space-y-4"><div className="text-sm text-muted-foreground">{t.sendTo} {filtered.filter(c => !c.is_blocked).length} {t.customersCount}{platformFilter !== "all" ? ` (${platformFilter === "whatsapp" ? t.whatsapp : t.telegram} ${t.only})` : ""}</div><div className="space-y-2"><Label>{t.text}</Label><Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} placeholder={t.offerHere} /></div><Button onClick={handleBulkSend} disabled={sending || !message.trim()} className="w-full"><Send className="h-4 w-4 ml-2" />{sending ? t.sending : `${t.send} ${filtered.filter(c => !c.is_blocked).length}`}</Button></div></DialogContent></Dialog>
    </div>
  );
};

export default CustomersTab;
