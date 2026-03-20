import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Store, CalendarCheck, Bell, Pencil, Wrench, LogOut, Clock, MapPin, Image } from "lucide-react";

// ==================== STATION INFO TAB ====================
const StationInfoTab = ({ stationId }: { stationId: string }) => {
  const [station, setStation] = useState<any>(null);
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("stations").select("*").eq("id", stationId).single();
    if (data) setStation(data);
  }, [stationId]);

  useEffect(() => { load(); }, [load]);

  const fieldLabels: Record<string, string> = {
    name: "اسم المحطة",
    address: "العنوان",
    detailed_address: "العنوان التفصيلي",
    working_hours_start: "بداية ساعات العمل",
    working_hours_end: "نهاية ساعات العمل",
    scheduling_type: "نوع المواعيد",
    image_url: "صورة المحطة",
  };

  const requestEdit = async () => {
    if (!editField || !editValue.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("edit_requests").insert({
      station_id: stationId,
      requested_by: user.id,
      field_name: editField,
      old_value: station?.[editField] || "",
      new_value: editValue,
    });

    toast({ title: "تم إرسال طلب التعديل", description: "سيتم مراجعته من قبل الإدارة" });
    setDialogOpen(false);
    setEditField(null);
    setEditValue("");
  };

  const openEditDialog = (field: string) => {
    setEditField(field);
    setEditValue(station?.[field] || "");
    setDialogOpen(true);
  };

  if (!station) return <p className="text-muted-foreground">جاري التحميل...</p>;

  const schedulingLabels: Record<string, string> = { slots: "فترات ثابتة", instant: "فوري", daily: "يومي" };

  const fields = [
    { key: "name", value: station.name, icon: <Store className="h-4 w-4" /> },
    { key: "address", value: station.address || "-", icon: <MapPin className="h-4 w-4" /> },
    { key: "detailed_address", value: station.detailed_address || "-", icon: <MapPin className="h-4 w-4" /> },
    { key: "working_hours_start", value: station.working_hours_start?.substring(0, 5), icon: <Clock className="h-4 w-4" /> },
    { key: "working_hours_end", value: station.working_hours_end?.substring(0, 5), icon: <Clock className="h-4 w-4" /> },
    { key: "scheduling_type", value: schedulingLabels[station.scheduling_type] || station.scheduling_type, icon: <CalendarCheck className="h-4 w-4" /> },
    { key: "image_url", value: station.image_url ? "موجودة" : "غير موجودة", icon: <Image className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">معلومات المحطة</h3>
      {station.image_url && (
        <div className="w-full max-w-md rounded-lg overflow-hidden border border-border">
          <img src={station.image_url} alt={station.name} className="w-full h-48 object-cover" />
        </div>
      )}
      <Card>
        <CardContent className="pt-6 space-y-3">
          {fields.map((f) => (
            <div key={f.key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div className="flex items-center gap-2">
                {f.icon}
                <span className="text-muted-foreground text-sm">{fieldLabels[f.key]}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{f.value}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(f.key)}>
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between py-2">
            <span className="text-muted-foreground text-sm">الحالة</span>
            <Badge variant={station.is_active ? "default" : "destructive"}>{station.is_active ? "مفعّلة" : "معطلة"}</Badge>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>طلب تعديل: {editField ? fieldLabels[editField] : ""}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>القيمة الحالية</Label>
              <Input value={editField ? (station[editField] || "") : ""} disabled />
            </div>
            <div>
              <Label>القيمة الجديدة</Label>
              <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} placeholder="أدخل القيمة الجديدة" />
            </div>
            <Button onClick={requestEdit} className="w-full">إرسال طلب التعديل</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ==================== SERVICES VIEW TAB ====================
const StationServicesTab = ({ stationId }: { stationId: string }) => {
  const [services, setServices] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("services").select("*").or(`station_id.eq.${stationId},station_id.is.null`).eq("is_active", true).order("sort_order");
      if (data) setServices(data);
    };
    load();
  }, [stationId]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">خدمات المحطة</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>الخدمة</TableHead><TableHead>السعر</TableHead><TableHead>المدة</TableHead><TableHead>النطاق</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.name}</TableCell>
              <TableCell>{s.price} د.ع</TableCell>
              <TableCell>{s.duration_minutes} دقيقة</TableCell>
              <TableCell>{s.station_id ? "خاصة" : "عامة"}</TableCell>
            </TableRow>
          ))}
          {services.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">لا توجد خدمات</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
};

// ==================== BOOKINGS TAB ====================
const StationBookingsTab = ({ stationId }: { stationId: string }) => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState("all");

  const load = useCallback(async () => {
    let q = supabase.from("bookings").select("*, services(name, price)").eq("station_id", stationId).order("created_at", { ascending: false }).limit(100);
    if (filterStatus !== "all") q = q.eq("status", filterStatus as any);
    const { data } = await q;
    if (data) setBookings(data);
  }, [stationId, filterStatus]);

  useEffect(() => { load(); }, [load]);

  // Realtime subscription for new bookings
  useEffect(() => {
    const channel = supabase
      .channel("station-bookings")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bookings", filter: `station_id=eq.${stationId}` }, () => {
        load();
        toast({ title: "📢 حجز جديد!", description: "تم استلام حجز جديد" });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [stationId, load]);

  const statusLabels: Record<string, string> = { pending: "قيد الانتظار", confirmed: "مؤكد", completed: "مكتمل", cancelled: "ملغي" };
  const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = { pending: "secondary", confirmed: "default", completed: "outline", cancelled: "destructive" };

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center flex-wrap">
        <h3 className="text-lg font-semibold text-foreground">الحجوزات</h3>
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
        <TableHeader><TableRow><TableHead>#</TableHead><TableHead>العميل</TableHead><TableHead>الخدمة</TableHead><TableHead>التاريخ</TableHead><TableHead>الوقت</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader>
        <TableBody>
          {bookings.map((b) => (
            <TableRow key={b.id}>
              <TableCell>#{b.booking_number}</TableCell>
              <TableCell>{b.customer_phone}</TableCell>
              <TableCell>{(b as any).services?.name} - {(b as any).services?.price} د.ع</TableCell>
              <TableCell>{b.booking_date}</TableCell>
              <TableCell>{b.booking_time?.substring(0, 5) || "-"}</TableCell>
              <TableCell><Badge variant={statusColors[b.status] || "secondary"}>{statusLabels[b.status] || b.status}</Badge></TableCell>
            </TableRow>
          ))}
          {bookings.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا توجد حجوزات</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
};

// ==================== NOTIFICATIONS TAB ====================
const NotificationsTab = () => {
  const [notifications, setNotifications] = useState<any[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50);
    if (data) setNotifications(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("my-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    load();
  };

  const markAllRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    load();
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">الإشعارات {unreadCount > 0 && <Badge className="mr-2">{unreadCount}</Badge>}</h3>
        {unreadCount > 0 && <Button variant="outline" size="sm" onClick={markAllRead}>تحديد الكل كمقروء</Button>}
      </div>
      <div className="space-y-2">
        {notifications.map((n) => (
          <Card key={n.id} className={`cursor-pointer transition-colors ${!n.is_read ? "border-primary bg-primary/5" : ""}`} onClick={() => !n.is_read && markRead(n.id)}>
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground text-sm">{n.title}</p>
                  <p className="text-muted-foreground text-xs mt-1">{n.body}</p>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap mr-4">
                  {new Date(n.created_at).toLocaleDateString("ar-IQ")} {new Date(n.created_at).toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {notifications.length === 0 && <p className="text-center text-muted-foreground py-8">لا توجد إشعارات</p>}
      </div>
    </div>
  );
};

// ==================== EDIT REQUESTS TAB ====================
const MyEditRequestsTab = ({ stationId }: { stationId: string }) => {
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("edit_requests").select("*").eq("requested_by", user.id).order("created_at", { ascending: false });
      if (data) setRequests(data);
    };
    load();
  }, [stationId]);

  const statusLabels: Record<string, string> = { pending: "قيد المراجعة", approved: "مقبول", rejected: "مرفوض" };
  const statusColors: Record<string, "default" | "secondary" | "destructive"> = { pending: "secondary", approved: "default", rejected: "destructive" };
  const fieldLabels: Record<string, string> = { name: "اسم المحطة", address: "العنوان", detailed_address: "العنوان التفصيلي", working_hours_start: "بداية العمل", working_hours_end: "نهاية العمل", scheduling_type: "نوع المواعيد", image_url: "الصورة" };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">طلبات التعديل</h3>
      <Table>
        <TableHeader><TableRow><TableHead>الحقل</TableHead><TableHead>القيمة القديمة</TableHead><TableHead>القيمة الجديدة</TableHead><TableHead>الحالة</TableHead><TableHead>ملاحظة</TableHead><TableHead>التاريخ</TableHead></TableRow></TableHeader>
        <TableBody>
          {requests.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{fieldLabels[r.field_name] || r.field_name}</TableCell>
              <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate">{r.old_value || "-"}</TableCell>
              <TableCell className="text-sm max-w-[150px] truncate">{r.new_value}</TableCell>
              <TableCell><Badge variant={statusColors[r.status]}>{statusLabels[r.status]}</Badge></TableCell>
              <TableCell className="text-sm">{r.admin_note || "-"}</TableCell>
              <TableCell className="text-sm">{new Date(r.created_at).toLocaleDateString("ar-IQ")}</TableCell>
            </TableRow>
          ))}
          {requests.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا توجد طلبات</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
};

// ==================== MAIN PAGE ====================
const StationPortal = () => {
  const navigate = useNavigate();
  const [stationId, setStationId] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: ownerData } = await supabase.from("station_owners").select("station_id, owner_name").eq("user_id", user.id).maybeSingle();
      if (ownerData) {
        setStationId(ownerData.station_id);
        setOwnerName(ownerData.owner_name);
      }

      const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_read", false);
      setUnreadCount(count || 0);
      setLoading(false);
    };
    load();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!stationId) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">لم يتم ربط حسابك بأي محطة.</p></div>;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Store className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">لوحة المحطة</h1>
            <span className="text-sm text-muted-foreground">({ownerName})</span>
          </div>
          <Button variant="ghost" onClick={handleLogout}>
            <LogOut className="h-4 w-4 ml-1" />تسجيل الخروج
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="info" dir="rtl">
          <TabsList className="mb-6">
            <TabsTrigger value="info" className="gap-1"><Store className="h-4 w-4" />المحطة</TabsTrigger>
            <TabsTrigger value="services" className="gap-1"><Wrench className="h-4 w-4" />الخدمات</TabsTrigger>
            <TabsTrigger value="bookings" className="gap-1"><CalendarCheck className="h-4 w-4" />الحجوزات</TabsTrigger>
            <TabsTrigger value="notifications" className="gap-1 relative">
              <Bell className="h-4 w-4" />الإشعارات
              {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-4 w-4 flex items-center justify-center">{unreadCount}</span>}
            </TabsTrigger>
            <TabsTrigger value="edit-requests" className="gap-1"><Pencil className="h-4 w-4" />طلبات التعديل</TabsTrigger>
          </TabsList>
          <TabsContent value="info"><StationInfoTab stationId={stationId} /></TabsContent>
          <TabsContent value="services"><StationServicesTab stationId={stationId} /></TabsContent>
          <TabsContent value="bookings"><StationBookingsTab stationId={stationId} /></TabsContent>
          <TabsContent value="notifications"><NotificationsTab /></TabsContent>
          <TabsContent value="edit-requests"><MyEditRequestsTab stationId={stationId} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default StationPortal;
