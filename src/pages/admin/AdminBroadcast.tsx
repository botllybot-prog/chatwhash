import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Send, Users, CheckCircle, XCircle, Megaphone } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useAppLanguage } from "@/lib/language";

interface Owner {
  id: string;
  owner_name: string;
  owner_phone: string | null;
  is_active: boolean;
  stations: { name: string } | null;
}

const texts = {
  ar: {
    title: "رسائل جماعية",
    subtitle: "إرسال رسائل واتساب لأصحاب المغاسل",
    message: "الرسالة",
    messagePlaceholder: "اكتب رسالتك هنا...",
    letters: "حرف",
    recipients: "المستقبلون",
    selected: "محدد",
    recipientsDesc: "اختر من يستقبل الرسالة",
    selectAll: "تحديد الكل",
    clearAll: "إلغاء الكل",
    all: "الكل",
    active: "النشطون",
    suspended: "الموقوفون",
    noOwners: "لا يوجد أصحاب مغاسل",
    noPhone: "لا يوجد رقم",
    suspendedBadge: "موقوف",
    emptyMessage: "الرسالة فارغة",
    nobodySelected: "لم تختر أحداً",
    sending: "جاري الإرسال...",
    sendTo: "إرسال إلى",
    person: "شخص",
    results: "نتائج الإرسال",
    success: "ناجح",
    failed: "فشل",
    sentSummary: "تم الإرسال",
  },
  en: {
    title: "Broadcast messages",
    subtitle: "Send WhatsApp messages to station owners",
    message: "Message",
    messagePlaceholder: "Write your message here...",
    letters: "characters",
    recipients: "Recipients",
    selected: "selected",
    recipientsDesc: "Choose who should receive the message",
    selectAll: "Select all",
    clearAll: "Clear all",
    all: "All",
    active: "Active",
    suspended: "Suspended",
    noOwners: "No station owners found",
    noPhone: "No phone number",
    suspendedBadge: "Suspended",
    emptyMessage: "Message is empty",
    nobodySelected: "No recipients selected",
    sending: "Sending...",
    sendTo: "Send to",
    person: "people",
    results: "Send results",
    success: "Success",
    failed: "Failed",
    sentSummary: "Sent",
  },
  ku: {
    title: "نامەی کۆمەڵەیی",
    subtitle: "ناردنی نامەی واتساپ بۆ خاوەن وێستگەکان",
    message: "نامە",
    messagePlaceholder: "نامەکەت لێرە بنووسە...",
    letters: "پیت",
    recipients: "وەرگرەکان",
    selected: "هەڵبژێردراو",
    recipientsDesc: "هەڵبژێرە کێ نامەکە وەردەگرێت",
    selectAll: "هەمووی هەڵبژێرە",
    clearAll: "هەمووی لاببە",
    all: "هەموو",
    active: "چالاک",
    suspended: "ڕاگیراو",
    noOwners: "هیچ خاوەن وێستگەیەک نییە",
    noPhone: "ژمارە نییە",
    suspendedBadge: "ڕاگیراو",
    emptyMessage: "نامەکە بەتاڵە",
    nobodySelected: "هیچ کەسێک هەڵنەبژێردراوە",
    sending: "ناردن لە کاردایە...",
    sendTo: "ناردن بۆ",
    person: "کەس",
    results: "ئەنجامی ناردن",
    success: "سەرکەوتوو",
    failed: "شکست",
    sentSummary: "نێردرا",
  },
  tr: {
    title: "Toplu mesajlar",
    subtitle: "İstasyon sahiplerine WhatsApp mesajı gönderin",
    message: "Mesaj",
    messagePlaceholder: "Mesajınızı buraya yazın...",
    letters: "karakter",
    recipients: "Alıcılar",
    selected: "seçildi",
    recipientsDesc: "Mesajı kimin alacağını seçin",
    selectAll: "Tümünü seç",
    clearAll: "Tümünü temizle",
    all: "Tümü",
    active: "Aktif",
    suspended: "Askıda",
    noOwners: "İstasyon sahibi bulunamadı",
    noPhone: "Telefon yok",
    suspendedBadge: "Askıda",
    emptyMessage: "Mesaj boş",
    nobodySelected: "Kimse seçilmedi",
    sending: "Gönderiliyor...",
    sendTo: "Gönder",
    person: "kişi",
    results: "Gönderim sonuçları",
    success: "Başarılı",
    failed: "Başarısız",
    sentSummary: "Gönderildi",
  },
} as const;

const AdminBroadcast = () => {
  const { language, isRtl } = useAppLanguage();
  const t = texts[language];
  const [owners, setOwners] = useState<Owner[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ name: string; ok: boolean }[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "suspended">("all");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("station_owners")
        .select("id, owner_name, owner_phone, is_active, stations(name)")
        .not("owner_phone", "is", null)
        .order("owner_name");
      if (data) setOwners(data as Owner[]);
    };
    load();
  }, []);

  const filtered = owners.filter((o) => {
    if (filter === "active") return o.is_active;
    if (filter === "suspended") return !o.is_active;
    return true;
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(filtered.map((o) => o.id)));
  const deselectAll = () => setSelected(new Set());

  const handleSend = async () => {
    if (!message.trim()) {
      toast({ title: t.emptyMessage, variant: "destructive" });
      return;
    }
    if (selected.size === 0) {
      toast({ title: t.nobodySelected, variant: "destructive" });
      return;
    }

    const targets = owners.filter((o) => selected.has(o.id) && o.owner_phone);
    setSending(true);
    setProgress(0);
    setResults([]);

    const newResults: { name: string; ok: boolean }[] = [];
    for (let i = 0; i < targets.length; i++) {
      const owner = targets[i];
      try {
        const res = await supabase.functions.invoke("whatsapp-send", {
          body: { phone: owner.owner_phone, message: message.trim() },
        });
        newResults.push({ name: owner.owner_name, ok: !res.error && !res.data?.error });
      } catch {
        newResults.push({ name: owner.owner_name, ok: false });
      }
      setProgress(Math.round(((i + 1) / targets.length) * 100));
      setResults([...newResults]);
    }

    setSending(false);
    const successCount = newResults.filter((r) => r.ok).length;
    toast({ title: `${t.sentSummary}: ${successCount}/${targets.length}` });
  };

  const sentOk = results.filter((r) => r.ok).length;
  const sentFail = results.filter((r) => !r.ok).length;

  return (
    <div className="max-w-3xl space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex items-center gap-3">
        <Megaphone className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.message}</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t.messagePlaceholder} rows={5} className="resize-none" />
          <p className="mt-1.5 text-xs text-muted-foreground">{message.length} {t.letters}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" /> {t.recipients}
                {selected.size > 0 && <Badge>{selected.size} {t.selected}</Badge>}
              </CardTitle>
              <CardDescription>{t.recipientsDesc}</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>{t.selectAll}</Button>
              <Button variant="ghost" size="sm" onClick={deselectAll}>{t.clearAll}</Button>
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            {(["all", "active", "suspended"] as const).map((f) => (
              <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="h-7 text-xs">
                {f === "all" ? t.all : f === "active" ? t.active : t.suspended}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{t.noOwners}</p>
            ) : (
              filtered.map((owner) => (
                <div
                  key={owner.id}
                  onClick={() => owner.owner_phone && toggleSelect(owner.id)}
                  className={`flex cursor-pointer items-center gap-3 rounded-md border p-2 transition-colors hover:bg-muted/50 ${selected.has(owner.id) ? "border-primary bg-primary/5" : ""} ${!owner.owner_phone ? "cursor-not-allowed opacity-40" : ""}`}
                >
                  <Checkbox checked={selected.has(owner.id)} disabled={!owner.owner_phone} onCheckedChange={() => owner.owner_phone && toggleSelect(owner.id)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{owner.owner_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {owner.stations?.name && <span className="ml-2">{owner.stations.name}</span>}
                      {owner.owner_phone ? <span dir="ltr">{owner.owner_phone}</span> : <span className="text-destructive">{t.noPhone}</span>}
                    </p>
                  </div>
                  {!owner.is_active && <Badge variant="secondary" className="text-[10px]">{t.suspendedBadge}</Badge>}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSend} disabled={sending || selected.size === 0 || !message.trim()} className="w-full" size="lg">
        <Send className="ml-2 h-4 w-4" />
        {sending ? `${t.sending} ${progress}%` : `${t.sendTo} ${selected.size} ${t.person}`}
      </Button>

      {sending && <Progress value={progress} className="h-2" />}

      {results.length > 0 && !sending && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-base">
              {t.results}
              <Badge className="bg-green-500 text-white">{sentOk} {t.success}</Badge>
              {sentFail > 0 && <Badge variant="destructive">{sentFail} {t.failed}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {results.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {r.ok ? <CheckCircle className="h-3.5 w-3.5 shrink-0 text-green-500" /> : <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />}
                  <span className={!r.ok ? "text-muted-foreground" : ""}>{r.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminBroadcast;
