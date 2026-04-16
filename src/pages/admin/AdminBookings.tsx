import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

const AdminBookings = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [filterStation, setFilterStation] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [stations, setStations] = useState<any[]>([]);

  const load = useCallback(async () => {
    const { data: st } = await supabase.from("stations").select("id, name");
    if (st) setStations(st);

    let q = supabase.from("bookings").select("*, stations(name), services(name, price)").order("created_at", { ascending: false }).limit(200);
    if (filterStation !== "all") q = q.eq("station_id", filterStation);
    if (filterStatus !== "all") q = q.eq("status", filterStatus as any);
    if (dateFrom) q = q.gte("booking_date", dateFrom);
    if (dateTo) q = q.lte("booking_date", dateTo);
    const { data } = await q;
    if (data) setBookings(data);
  }, [filterStation, filterStatus, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const statusLabels: Record<string, string> = {
    pending: "قيد الانتظار",
    confirmed: "مؤكد",
    completed: "مكتمل",
    cancelled: "ملغي",
    pending_customer_approval: "انتظار موافقة العميل",
  };
  const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    pending: "secondary",
    confirmed: "default",
    completed: "outline",
    cancelled: "destructive",
    pending_customer_approval: "secondary",
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("bookings").update({ status: status as any }).eq("id", id);
    if (error) {
      toast({ title: "حدث خطأ", description: error.message, variant: "destructive" });
      return;
    }
    await load();
    toast({ title: "تم تحديث الحالة" });
  };

  const exportCSV = async () => {
    // Always export confirmed bookings with current filters
    let q = supabase.from("bookings")
      .select("booking_number, customer_phone, customer_name, booking_date, booking_time, status, created_at, stations(name), services(name, price)")
      .eq("status", "confirmed" as any)
      .order("booking_date", { ascending: false });
    if (filterStation !== "all") q = q.eq("station_id", filterStation);
    if (dateFrom) q = q.gte("booking_date", dateFrom);
    if (dateTo) q = q.lte("booking_date", dateTo);
    const { data, error } = await q;
    if (error) { toast({ title: "خطأ في التصدير", description: error.message, variant: "destructive" }); return; }
    if (!data || data.length === 0) { toast({ title: "لا توجد حجوزات مؤكدة", description: "لا توجد بيانات للتصدير بالفلاتر المحددة." }); return; }

    const rows = [
      ["رقم الحجز", "اسم العميل", "هاتف العميل", "المحطة", "الخدمة", "السعر (د.ع)", "تاريخ الحجز", "وقت الحجز", "تاريخ الإنشاء"],
      ...data.map((b: any) => [
        `#${b.booking_number}`,
        b.customer_name || "",
        b.customer_phone || "",
        (b.stations as any)?.name || "",
        (b.services as any)?.name || "",
        (b.services as any)?.price || "",
        b.booking_date || "",
        b.booking_time?.substring(0, 5) || "",
        b.created_at ? new Date(b.created_at).toLocaleDateString("ar-IQ") : "",
      ]),
    ];

    const csvContent = "\uFEFF" + rows.map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ).join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stationName = stations.find(s => s.id === filterStation)?.name || "جميع_المحطات";
    const dateLabel = dateFrom && dateTo ? `${dateFrom}_to_${dateTo}` : new Date().toISOString().split("T")[0];
    link.href = url;
    link.download = `حجوزات_مؤكدة_${stationName}_${dateLabel}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: `✅ تم تصدير ${data.length} حجز مؤكد` });
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
          <SelectTrigger className="w-44"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            <SelectItem value="pending">قيد الانتظار</SelectItem>
            <SelectItem value="confirmed">مؤكد</SelectItem>
            <SelectItem value="pending_customer_approval">انتظار موافقة العميل</SelectItem>
            <SelectItem value="completed">مكتمل</SelectItem>
            <SelectItem value="cancelled">ملغي</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">من:</span>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36 h-9" />
          <span className="text-sm text-muted-foreground">إلى:</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36 h-9" />
        </div>
        <Button onClick={exportCSV} variant="outline" className="gap-2">
          📊 تصدير CSV (مؤكد)
        </Button>
      </div>

      <Table>
        <TableHeader><TableRow><TableHead>#</TableHead><TableHead>العميل</TableHead><TableHead>المحطة</TableHead><TableHead>الخدمة</TableHead><TableHead>التاريخ</TableHead><TableHead>الوقت</TableHead><TableHead>الحالة</TableHead><TableHead>إجراءات</TableHead></TableRow></TableHeader>
        <TableBody>
          {bookings.map((b) => (
            <TableRow key={b.id}>
              <TableCell>#{b.booking_number}</TableCell>
              <TableCell>{b.customer_name || b.customer_phone}</TableCell>
              <TableCell>{(b as any).stations?.name}</TableCell>
              <TableCell>{(b as any).services?.name} - {(b as any).services?.price} د.ع</TableCell>
              <TableCell>{b.booking_date}</TableCell>
              <TableCell>{b.booking_time?.substring(0, 5) || "-"}</TableCell>
              <TableCell><Badge variant={statusColors[b.status] || "secondary"}>{statusLabels[b.status] || b.status}</Badge></TableCell>
              <TableCell>
                <Select value={b.status} onValueChange={(v) => updateStatus(b.id, v)}>
                  <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">قيد الانتظار</SelectItem>
                    <SelectItem value="confirmed">مؤكد</SelectItem>
                    <SelectItem value="pending_customer_approval">انتظار موافقة العميل</SelectItem>
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

export default AdminBookings;

