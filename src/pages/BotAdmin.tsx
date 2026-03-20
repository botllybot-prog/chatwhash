import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Plus, Pencil, Trash2, Store, Wrench, CalendarCheck, Settings, Bot, BarChart3, Bell, Users, FileEdit } from "lucide-react";
import ReportsTab from "@/components/bot-admin/ReportsTab";
import StationsTab from "@/components/bot-admin/StationsTab";
import OwnersTab from "@/components/bot-admin/OwnersTab";
import EditRequestsTab from "@/components/bot-admin/EditRequestsTab";

// ==================== SERVICES TAB ====================
const ServicesTab = () => {
  const [services, setServices] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", price: 0, duration_minutes: 30, station_id: "" as string | null, is_active: true, sort_order: 0 });

  const load = useCallback(async () => {
    const [{ data: svc }, { data: st }] = await Promise.all([
      supabase.from("services").select("*, stations(name)").order("sort_order"),
      supabase.from("stations").select("id, name").order("created_at"),
    ]);
    if (svc) setServices(svc);
    if (st) setStations(st);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: "الاسم مطلوب", variant: "destructive" }); return; }
    const payload = { ...form, price: Number(form.price), duration_minutes: Number(form.duration_minutes), sort_order: Number(form.sort_order), station_id: form.station_id || null };
    if (editing) {
      await supabase.from("services").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("services").insert(payload);
    }
    setDialogOpen(false);
    setEditing(null);
    setForm({ name: "", price: 0, duration_minutes: 30, station_id: "", is_active: true, sort_order: 0 });
    load();
    toast({ title: editing ? "تم التحديث" : "تمت الإضافة" });
  };

  const handleDelete = async (id: string) => {
    await supabase.from("services").delete().eq("id", id);
    load();
    toast({ title: "تم الحذف" });
  };

  const openEdit = (s: any) => {
    setEditing(s);
    setForm({ name: s.name, price: s.price, duration_minutes: s.duration_minutes, station_id: s.station_id || "", is_active: s.is_active, sort_order: s.sort_order });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-foreground">الخدمات</h3>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditing(null); setForm({ name: "", price: 0, duration_minutes: 30, station_id: "", is_active: true, sort_order: 0 }); } }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 ml-1" />إضافة خدمة</Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>{editing ? "تعديل خدمة" : "إضافة خدمة جديدة"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>اسم الخدمة</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="غسيل خارجي" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>السعر (دينار عراقي)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></div>
                <div><Label>المدة (دقائق)</Label><Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} /></div>
              </div>
              <div><Label>المحطة (اتركه فارغاً للكل)</Label>
                <Select value={form.station_id || "all"} onValueChange={(v) => setForm({ ...form, station_id: v === "all" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع المحطات</SelectItem>
                    {stations.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>الترتيب</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label>مفعّلة</Label>
              </div>
              <Button onClick={handleSave} className="w-full">{editing ? "تحديث" : "إضافة"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader><TableRow><TableHead>الخدمة</TableHead><TableHead>السعر</TableHead><TableHead>المدة</TableHead><TableHead>المحطة</TableHead><TableHead>الحالة</TableHead><TableHead>إجراءات</TableHead></TableRow></TableHeader>
        <TableBody>
          {services.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.name}</TableCell>
              <TableCell>{s.price} د.ع</TableCell>
              <TableCell>{s.duration_minutes} دقيقة</TableCell>
              <TableCell>{(s as any).stations?.name || "الكل"}</TableCell>
              <TableCell><Badge variant={s.is_active ? "default" : "outline"}>{s.is_active ? "مفعّلة" : "معطلة"}</Badge></TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {services.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا توجد خدمات بعد</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
};

// ==================== BOOKINGS TAB ====================
const BookingsTab = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [filterStation, setFilterStation] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [stations, setStations] = useState<any[]>([]);

  const load = useCallback(async () => {
    const { data: st } = await supabase.from("stations").select("id, name");
    if (st) setStations(st);

    let q = supabase.from("bookings").select("*, stations(name), services(name, price)").order("created_at", { ascending: false }).limit(100);
    if (filterStation !== "all") q = q.eq("station_id", filterStation);
    if (filterStatus !== "all") q = q.eq("status", filterStatus as any);
    const { data } = await q;
    if (data) setBookings(data);
  }, [filterStation, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const statusLabels: Record<string, string> = { pending: "قيد الانتظار", confirmed: "مؤكد", completed: "مكتمل", cancelled: "ملغي" };
  const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = { pending: "secondary", confirmed: "default", completed: "outline", cancelled: "destructive" };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("bookings").update({ status: status as any }).eq("id", id);
    load();
    toast({ title: "تم تحديث الحالة" });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center flex-wrap">
        <h3 className="text-lg font-semibold text-foreground">الحجوزات</h3>
        <Select value={filterStation} onValueChange={setFilterStation}>
          <SelectTrigger className="w-40"><SelectValue placeholder="المحطة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع المحطات</SelectItem>
            {stations.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            <SelectItem value="pending">قيد الانتظار</SelectItem>
            <SelectItem value="confirmed">مؤكد</SelectItem>
            <SelectItem value="completed">مكتمل</SelectItem>
            <SelectItem value="cancelled">ملغي</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader><TableRow><TableHead>#</TableHead><TableHead>العميل</TableHead><TableHead>المحطة</TableHead><TableHead>الخدمة</TableHead><TableHead>التاريخ</TableHead><TableHead>الوقت</TableHead><TableHead>الحالة</TableHead><TableHead>إجراءات</TableHead></TableRow></TableHeader>
        <TableBody>
          {bookings.map((b) => (
            <TableRow key={b.id}>
              <TableCell>#{b.booking_number}</TableCell>
              <TableCell>{b.customer_phone}</TableCell>
              <TableCell>{(b as any).stations?.name}</TableCell>
              <TableCell>{(b as any).services?.name} - {(b as any).services?.price} د.ع</TableCell>
              <TableCell>{b.booking_date}</TableCell>
              <TableCell>{b.booking_time?.substring(0, 5) || "-"}</TableCell>
              <TableCell><Badge variant={statusColors[b.status] || "secondary"}>{statusLabels[b.status] || b.status}</Badge></TableCell>
              <TableCell>
                <Select value={b.status} onValueChange={(v) => updateStatus(b.id, v)}>
                  <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">قيد الانتظار</SelectItem>
                    <SelectItem value="confirmed">مؤكد</SelectItem>
                    <SelectItem value="completed">مكتمل</SelectItem>
                    <SelectItem value="cancelled">ملغي</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
            </TableRow>
          ))}
          {bookings.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">لا توجد حجوزات</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
};

// ==================== SETTINGS TAB ====================
const BotSettingsTab = () => {
  const [botEnabled, setBotEnabled] = useState(true);
  const [welcomeMsg, setWelcomeMsg] = useState("");
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [reminderMsg, setReminderMsg] = useState("تذكير: لديك حجز غسيل سيارة خلال ساعة.\n📍 المحطة: {station}\n🔧 الخدمة: {service}\n🕐 الوقت: {time}\n📋 رقم الحجز: #{booking_number}\nنتطلع لخدمتك! 🚗✨");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("app_settings").select("key, value").in("key", ["BOT_ENABLED", "BOT_WELCOME_MESSAGE", "REMINDERS_ENABLED", "REMINDER_MESSAGE"]);
      if (data) {
        for (const row of data) {
          if (row.key === "BOT_ENABLED") setBotEnabled(row.value === "true");
          if (row.key === "BOT_WELCOME_MESSAGE") setWelcomeMsg(row.value);
          if (row.key === "REMINDERS_ENABLED") setRemindersEnabled(row.value === "true");
          if (row.key === "REMINDER_MESSAGE") setReminderMsg(row.value);
        }
      }
      setLoading(false);
    };
    load();
  }, []);

  const save = async () => {
    await Promise.all([
      supabase.from("app_settings").upsert({ key: "BOT_ENABLED", value: botEnabled ? "true" : "false" }, { onConflict: "key" }),
      supabase.from("app_settings").upsert({ key: "BOT_WELCOME_MESSAGE", value: welcomeMsg }, { onConflict: "key" }),
      supabase.from("app_settings").upsert({ key: "REMINDERS_ENABLED", value: remindersEnabled ? "true" : "false" }, { onConflict: "key" }),
      supabase.from("app_settings").upsert({ key: "REMINDER_MESSAGE", value: reminderMsg }, { onConflict: "key" }),
    ]);
    toast({ title: "تم الحفظ" });
  };

  if (loading) return <p className="text-muted-foreground">جاري التحميل...</p>;

  return (
    <div className="space-y-6 max-w-lg">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5" />إعدادات البوت</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>تفعيل البوت</Label>
            <Switch checked={botEnabled} onCheckedChange={setBotEnabled} />
          </div>
          <div>
            <Label>رسالة الترحيب</Label>
            <Input value={welcomeMsg} onChange={(e) => setWelcomeMsg(e.target.value)} placeholder="مرحباً بك في خدمة غسيل السيارات!" />
          </div>
          <Button onClick={save} className="w-full">حفظ الإعدادات</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />إشعارات التذكير</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>تفعيل التذكير قبل الموعد بساعة</Label>
            <Switch checked={remindersEnabled} onCheckedChange={setRemindersEnabled} />
          </div>
          <div>
            <Label>رسالة التذكير</Label>
            <textarea
              value={reminderMsg}
              onChange={(e) => setReminderMsg(e.target.value)}
              placeholder="رسالة التذكير..."
              rows={5}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              المتغيرات المتاحة: {"{station}"} {"{service}"} {"{time}"} {"{date}"} {"{booking_number}"}
            </p>
          </div>
          <Button onClick={save} className="w-full">حفظ الإعدادات</Button>
        </CardContent>
      </Card>
    </div>
  );
};

// ==================== MAIN PAGE ====================
const BotAdmin = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">إدارة بوت الحجز</h1>
          </div>
          <Button variant="ghost" onClick={() => navigate("/conversations")}>
            <ArrowRight className="h-4 w-4 ml-1" />المحادثات
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="stations" dir="rtl">
          <TabsList className="mb-6">
            <TabsTrigger value="stations" className="gap-1"><Store className="h-4 w-4" />المحطات</TabsTrigger>
            <TabsTrigger value="services" className="gap-1"><Wrench className="h-4 w-4" />الخدمات</TabsTrigger>
            <TabsTrigger value="bookings" className="gap-1"><CalendarCheck className="h-4 w-4" />الحجوزات</TabsTrigger>
            <TabsTrigger value="owners" className="gap-1"><Users className="h-4 w-4" />الحسابات</TabsTrigger>
            <TabsTrigger value="edit-requests" className="gap-1"><FileEdit className="h-4 w-4" />طلبات التعديل</TabsTrigger>
            <TabsTrigger value="reports" className="gap-1"><BarChart3 className="h-4 w-4" />التقارير</TabsTrigger>
            <TabsTrigger value="settings" className="gap-1"><Settings className="h-4 w-4" />الإعدادات</TabsTrigger>
          </TabsList>
          <TabsContent value="stations"><StationsTab /></TabsContent>
          <TabsContent value="services"><ServicesTab /></TabsContent>
          <TabsContent value="bookings"><BookingsTab /></TabsContent>
          <TabsContent value="owners"><OwnersTab /></TabsContent>
          <TabsContent value="edit-requests"><EditRequestsTab /></TabsContent>
          <TabsContent value="reports"><ReportsTab /></TabsContent>
          <TabsContent value="settings"><BotSettingsTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BotAdmin;
