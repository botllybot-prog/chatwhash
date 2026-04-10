import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Search, Send, Users, MessageCircle, Ban, CheckCircle, Filter } from "lucide-react";

type BotCustomer = {
  id: string;
  phone: string;
  name: string | null;
  platform: string;
  first_seen_at: string;
  last_seen_at: string;
  total_bookings: number;
  last_booking_at: string | null;
  is_blocked: boolean;
  notes: string | null;
};

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

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("bot_customers")
      .select("*")
      .order("last_seen_at", { ascending: false });

    if (data) {
      setCustomers(data);
      setStats({
        total: data.length,
        whatsapp: data.filter((c: BotCustomer) => c.platform === "whatsapp").length,
        telegram: data.filter((c: BotCustomer) => c.platform === "telegram").length,
        withBookings: data.filter((c: BotCustomer) => c.total_bookings > 0).length,
      });
    }
    if (error) console.error("Load customers error:", error);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = customers.filter((c) => {
    const matchSearch = !search || c.phone.includes(search) || (c.name || "").includes(search);
    const matchPlatform = platformFilter === "all" || c.platform === platformFilter;
    return matchSearch && matchPlatform;
  });

  const handleSendMessage = async () => {
    if (!selectedCustomer || !message.trim()) return;
    setSending(true);
    try {
      if (selectedCustomer.platform === "whatsapp") {
        const { error } = await supabase.functions.invoke("whatsapp-send", {
          body: { phone: selectedCustomer.phone, message: message.trim() },
        });
        if (error) throw error;
      } else {
        // Telegram - send via bot API
        const { data: settings } = await (supabase as any)
          .from("app_settings")
          .select("key, value")
          .in("key", ["TELEGRAM_BOT_TOKEN"]);
        const token = settings?.find((s: any) => s.key === "TELEGRAM_BOT_TOKEN")?.value;
        if (token) {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: selectedCustomer.phone, text: message.trim() }),
          });
        }
      }
      toast({ title: "تم إرسال الرسالة بنجاح ✅" });
      setMessage("");
      setSendDialogOpen(false);
    } catch (err: any) {
      toast({ title: "فشل إرسال الرسالة", description: err?.message, variant: "destructive" });
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
          await supabase.functions.invoke("whatsapp-send", {
            body: { phone: c.phone, message: message.trim() },
          });
        } else {
          const { data: settings } = await (supabase as any)
            .from("app_settings")
            .select("key, value")
            .in("key", ["TELEGRAM_BOT_TOKEN"]);
          const token = settings?.find((s: any) => s.key === "TELEGRAM_BOT_TOKEN")?.value;
          if (token) {
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: c.phone, text: message.trim() }),
            });
          }
        }
        sent++;
      } catch {
        failed++;
      }
      // Rate limit: ~1 msg per 100ms
      await new Promise((r) => setTimeout(r, 100));
    }

    toast({ title: `تم الإرسال: ${sent} نجح، ${failed} فشل` });
    setMessage("");
    setBulkDialogOpen(false);
    setSending(false);
  };

  const toggleBlock = async (customer: BotCustomer) => {
    const { error } = await (supabase as any)
      .from("bot_customers")
      .update({ is_blocked: !customer.is_blocked })
      .eq("id", customer.id);
    if (error) {
      toast({ title: "حدث خطأ", description: error.message, variant: "destructive" });
      return;
    }
    await load();
    toast({ title: customer.is_blocked ? "تم إلغاء الحظر" : "تم حظر العميل" });
  };

  const updateNotes = async (id: string, notes: string) => {
    await (supabase as any).from("bot_customers").update({ notes }).eq("id", id);
    await load();
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("ar-IQ", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  if (loading) return <p className="text-muted-foreground text-center py-12">جاري التحميل...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">عملاء البوت</h2>
        <Button onClick={() => { setMessage(""); setBulkDialogOpen(true); }} variant="default">
          <Send className="h-4 w-4 ml-2" />
          إرسال رسالة جماعية ({filtered.filter(c => !c.is_blocked).length})
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4 text-center">
            <Users className="h-6 w-6 mx-auto text-primary mb-1" />
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">إجمالي العملاء</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <MessageCircle className="h-6 w-6 mx-auto text-green-600 mb-1" />
            <div className="text-2xl font-bold">{stats.whatsapp}</div>
            <div className="text-xs text-muted-foreground">واتساب</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <MessageCircle className="h-6 w-6 mx-auto text-blue-500 mb-1" />
            <div className="text-2xl font-bold">{stats.telegram}</div>
            <div className="text-xs text-muted-foreground">تلقرام</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <CheckCircle className="h-6 w-6 mx-auto text-orange-500 mb-1" />
            <div className="text-2xl font-bold">{stats.withBookings}</div>
            <div className="text-xs text-muted-foreground">لديهم حجوزات</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="بحث بالهاتف أو الاسم..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10"
          />
        </div>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-40">
            <Filter className="h-4 w-4 ml-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="whatsapp">واتساب</SelectItem>
            <SelectItem value="telegram">تلقرام</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الاسم</TableHead>
                <TableHead className="text-right">الهاتف</TableHead>
                <TableHead className="text-right">المنصة</TableHead>
                <TableHead className="text-right">الحجوزات</TableHead>
                <TableHead className="text-right">آخر نشاط</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    لا يوجد عملاء بعد
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow key={c.id} className={c.is_blocked ? "opacity-50" : ""}>
                    <TableCell className="font-medium">{c.name || "—"}</TableCell>
                    <TableCell className="font-mono text-sm" dir="ltr">{c.phone}</TableCell>
                    <TableCell>
                      <Badge variant={c.platform === "whatsapp" ? "default" : "secondary"} className="text-xs">
                        {c.platform === "whatsapp" ? "واتساب" : "تلقرام"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{c.total_bookings}</TableCell>
                    <TableCell className="text-xs">{formatDate(c.last_seen_at)}</TableCell>
                    <TableCell>
                      {c.is_blocked ? (
                        <Badge variant="destructive" className="text-xs">محظور</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-green-600">نشط</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setSelectedCustomer(c); setMessage(""); setSendDialogOpen(true); }}
                          title="إرسال رسالة"
                        >
                          <Send className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant={c.is_blocked ? "outline" : "destructive"}
                          onClick={() => toggleBlock(c)}
                          title={c.is_blocked ? "إلغاء الحظر" : "حظر"}
                        >
                          {c.is_blocked ? <CheckCircle className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Send Single Message Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إرسال رسالة إلى {selectedCustomer?.name || selectedCustomer?.phone}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              المنصة: {selectedCustomer?.platform === "whatsapp" ? "واتساب" : "تلقرام"} | الهاتف: {selectedCustomer?.phone}
            </div>
            <div className="space-y-2">
              <Label>نص الرسالة</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="اكتب رسالتك هنا..."
              />
            </div>
            <Button onClick={handleSendMessage} disabled={sending || !message.trim()} className="w-full">
              <Send className="h-4 w-4 ml-2" />
              {sending ? "جاري الإرسال..." : "إرسال"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Send Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إرسال رسالة جماعية</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              سيتم الإرسال إلى {filtered.filter(c => !c.is_blocked).length} عميل
              {platformFilter !== "all" && ` (${platformFilter === "whatsapp" ? "واتساب" : "تلقرام"} فقط)`}
            </div>
            <div className="space-y-2">
              <Label>نص الرسالة</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder="اكتب رسالتك / عرضك هنا..."
              />
            </div>
            <Button onClick={handleBulkSend} disabled={sending || !message.trim()} className="w-full" variant="default">
              <Send className="h-4 w-4 ml-2" />
              {sending ? "جاري الإرسال..." : `إرسال إلى ${filtered.filter(c => !c.is_blocked).length} عميل`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomersTab;
