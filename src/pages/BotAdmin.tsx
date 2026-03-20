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
import { ArrowRight, Plus, Pencil, Trash2, Store, Wrench, CalendarCheck, Settings, Bot, BarChart3 } from "lucide-react";
import ReportsTab from "@/components/bot-admin/ReportsTab";

// ==================== STATIONS TAB ====================
const StationsTab = () => {
  const [stations, setStations] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", address: "", working_hours_start: "08:00", working_hours_end: "22:00", slot_duration_minutes: 30, scheduling_type: "slots" as "slots" | "instant" | "daily", is_active: true });

  const load = useCallback(async () => {
    const { data } = await supabase.from("stations").select("*").order("created_at");
    if (data) setStations(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: "الاسم مطلوب", variant: "destructive" }); return; }
    const payload = { ...form, slot_duration_minutes: Number(form.slot_duration_minutes) };
    if (editing) {
      await supabase.from("stations").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("stations").insert(payload);
    }
    setDialogOpen(false);
    setEditing(null);
    setForm({ name: "", address: "", working_hours_start: "08:00", working_hours_end: "22:00", slot_duration_minutes: 30, scheduling_type: "slots", is_active: true });
    load();
    toast({ title: editing ? "تم التحديث" : "تمت الإضافة" });
  };

  const handleDelete = async (id: string) => {
    await supabase.from("stations").delete().eq("id", id);
    load();
    toast({ title: "تم الحذف" });
  };

  const openEdit = (s: any) => {
    setEditing(s);
    setForm({ name: s.name, address: s.address || "", working_hours_start: s.working_hours_start, working_hours_end: s.working_hours_end, slot_duration_minutes: s.slot_duration_minutes, scheduling_type: s.scheduling_type, is_active: s.is_active });
    setDialogOpen(true);
  };

  const schedulingLabels: Record<string, string> = { slots: "فترات ثابتة", instant: "حجز فوري", daily: "يومي" };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-foreground">المحطات</h3>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditing(null); setForm({ name: "", address: "", working_hours_start: "08:00", working_hours_end: "22:00", slot_duration_minutes: 30, scheduling_type: "slots", is_active: true }); } }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 ml-1" />إضافة محطة</Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>{editing ? "تعديل محطة" : "إضافة محطة جديدة"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>اسم المحطة</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="محطة الرياض" /></div>
              <div><Label>العنوان</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="حي النخيل" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>بداية العمل</Label><Input type="time" value={form.working_hours_start} onChange={(e) => setForm({ ...form, working_hours_start: e.target.value })} /></div>
                <div><Label>نهاية العمل</Label><Input type="time" value={form.working_hours_end} onChange={(e) => setForm({ ...form, working_hours_end: e.target.value })} /></div>
              </div>
              <div><Label>نوع المواعيد</Label>
                <Select value={form.scheduling_type} onValueChange={(v: "slots" | "instant" | "daily") => setForm({ ...form, scheduling_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slots">فترات زمنية ثابتة</SelectItem>
                    <SelectItem value="instant">حجز فوري</SelectItem>
                    <SelectItem value="daily">اختيار اليوم فقط</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.scheduling_type === "slots" && (
                <div><Label>مدة الفترة (دقائق)</Label><Input type="number" value={form.slot_duration_minutes} onChange={(e) => setForm({ ...form, slot_duration_minutes: Number(e.target.value) })} /></div>
              )}
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
        <TableHeader><TableRow><TableHead>المحطة</TableHead><TableHead>العنوان</TableHead><TableHead>ساعات العمل</TableHead><TableHead>نوع المواعيد</TableHead><TableHead>الحالة</TableHead><TableHead>إجراءات</TableHead></TableRow></TableHeader>
        <TableBody>
          {stations.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.name}</TableCell>
              <TableCell>{s.address || "-"}</TableCell>
              <TableCell>{s.working_hours_start?.substring(0, 5)} - {s.working_hours_end?.substring(0, 5)}</TableCell>
              <TableCell><Badge variant="secondary">{schedulingLabels[s.scheduling_type] || s.scheduling_type}</Badge></TableCell>
              <TableCell><Badge variant={s.is_active ? "default" : "outline"}>{s.is_active ? "مفعّلة" : "معطلة"}</Badge></TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {stations.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا توجد محطات بعد</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
};

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
                <div><Label>السعر (ريال)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></div>
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
              <TableCell>{s.price} ريال</TableCell>
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
              <TableCell>{(b as any).services?.name} - {(b as any).services?.price} ريال</TableCell>
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("app_settings").select("key, value").in("key", ["BOT_ENABLED", "BOT_WELCOME_MESSAGE"]);
      if (data) {
        for (const row of data) {
          if (row.key === "BOT_ENABLED") setBotEnabled(row.value === "true");
          if (row.key === "BOT_WELCOME_MESSAGE") setWelcomeMsg(row.value);
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
            <TabsTrigger value="settings" className="gap-1"><Settings className="h-4 w-4" />الإعدادات</TabsTrigger>
          </TabsList>
          <TabsContent value="stations"><StationsTab /></TabsContent>
          <TabsContent value="services"><ServicesTab /></TabsContent>
          <TabsContent value="bookings"><BookingsTab /></TabsContent>
          <TabsContent value="settings"><BotSettingsTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BotAdmin;
