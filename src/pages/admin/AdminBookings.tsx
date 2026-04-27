import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { useAppLanguage } from "@/lib/language";

const texts = {
  ar: {
    title: "الحجوزات",
    station: "المحطة",
    status: "الحالة",
    allStations: "جميع المحطات",
    allStatuses: "جميع الحالات",
    from: "من:",
    to: "إلى:",
    export: "تصدير CSV (مؤكد)",
    pending: "قيد الانتظار",
    confirmed: "مؤكد",
    pendingCustomerApproval: "انتظار موافقة العميل",
    completed: "مكتمل",
    cancelled: "ملغي",
    updated: "تم تحديث الحالة",
    error: "حدث خطأ",
    exportError: "خطأ في التصدير",
    noConfirmed: "لا توجد حجوزات مؤكدة",
    noConfirmedDesc: "لا توجد بيانات للتصدير بالفلاتر المحددة.",
    exportDone: "تم تصدير",
    exportDoneSuffix: "حجز مؤكد",
    headers: ["#", "العميل", "المحطة", "الخدمة", "التاريخ", "الوقت", "الحالة", "إجراءات"],
    noBookings: "لا توجد حجوزات",
    csvHeaders: ["رقم الحجز", "اسم العميل", "هاتف العميل", "المحطة", "الخدمة", "السعر (د.ع)", "تاريخ الحجز", "وقت الحجز", "تاريخ الإنشاء"],
    allStationsFile: "جميع_المحطات",
    currency: "د.ع",
    locale: "ar-IQ",
  },
  en: {
    title: "Bookings",
    station: "Station",
    status: "Status",
    allStations: "All stations",
    allStatuses: "All statuses",
    from: "From:",
    to: "To:",
    export: "Export CSV (confirmed)",
    pending: "Pending",
    confirmed: "Confirmed",
    pendingCustomerApproval: "Pending customer approval",
    completed: "Completed",
    cancelled: "Cancelled",
    updated: "Status updated",
    error: "An error occurred",
    exportError: "Export error",
    noConfirmed: "No confirmed bookings",
    noConfirmedDesc: "There is no data to export for the selected filters.",
    exportDone: "Exported",
    exportDoneSuffix: "confirmed bookings",
    headers: ["#", "Customer", "Station", "Service", "Date", "Time", "Status", "Actions"],
    noBookings: "No bookings found",
    csvHeaders: ["Booking number", "Customer name", "Customer phone", "Station", "Service", "Price (IQD)", "Booking date", "Booking time", "Created at"],
    allStationsFile: "all_stations",
    currency: "IQD",
    locale: "en-US",
  },
  ku: {
    title: "حجزەکان",
    station: "وێستگە",
    status: "دۆخ",
    allStations: "هەموو وێستگەکان",
    allStatuses: "هەموو دۆخەکان",
    from: "لە:",
    to: "بۆ:",
    export: "CSV هەناردە بکە (پشتڕاستکراوە)",
    pending: "چاوەڕوان",
    confirmed: "پشتڕاستکراوە",
    pendingCustomerApproval: "چاوەڕوانی ڕەزامەندی کڕیار",
    completed: "تەواوبوو",
    cancelled: "هەڵوەشایەوە",
    updated: "دۆخ نوێکرایەوە",
    error: "هەڵەیەک ڕوویدا",
    exportError: "هەڵە لە هەناردەکردندا",
    noConfirmed: "هیچ حجزی پشتڕاستکراو نییە",
    noConfirmedDesc: "هیچ داتایەک بۆ هەناردەکردن نییە بەپێی فلتەرە دیاریکراوەکان.",
    exportDone: "هەناردە کرا",
    exportDoneSuffix: "حجزی پشتڕاستکراو",
    headers: ["#", "کڕیار", "وێستگە", "خزمەتگوزاری", "بەروار", "کات", "دۆخ", "کردارەکان"],
    noBookings: "هیچ حجزێک نییە",
    csvHeaders: ["ژمارەی حجز", "ناوی کڕیار", "ژمارەی کڕیار", "وێستگە", "خزمەتگوزاری", "نرخ (د.ع)", "بەرواری حجز", "کاتی حجز", "بەرواری دروستکردن"],
    allStationsFile: "all_stations",
    currency: "د.ع",
    locale: "ku",
  },
  tr: {
    title: "Rezervasyonlar",
    station: "İstasyon",
    status: "Durum",
    allStations: "Tüm istasyonlar",
    allStatuses: "Tüm durumlar",
    from: "Başlangıç:",
    to: "Bitiş:",
    export: "CSV dışa aktar (onaylı)",
    pending: "Beklemede",
    confirmed: "Onaylandı",
    pendingCustomerApproval: "Müşteri onayı bekleniyor",
    completed: "Tamamlandı",
    cancelled: "İptal edildi",
    updated: "Durum güncellendi",
    error: "Bir hata oluştu",
    exportError: "Dışa aktarma hatası",
    noConfirmed: "Onaylı rezervasyon yok",
    noConfirmedDesc: "Seçilen filtreler için dışa aktarılacak veri yok.",
    exportDone: "Dışa aktarıldı",
    exportDoneSuffix: "onaylı rezervasyon",
    headers: ["#", "Müşteri", "İstasyon", "Hizmet", "Tarih", "Saat", "Durum", "İşlemler"],
    noBookings: "Rezervasyon bulunamadı",
    csvHeaders: ["Rezervasyon no", "Müşteri adı", "Müşteri telefonu", "İstasyon", "Hizmet", "Fiyat (IQD)", "Rezervasyon tarihi", "Rezervasyon saati", "Oluşturulma tarihi"],
    allStationsFile: "all_stations",
    currency: "IQD",
    locale: "tr-TR",
  },
} as const;

const AdminBookings = () => {
  const { language, isRtl } = useAppLanguage();
  const t = texts[language];
  const [bookings, setBookings] = useState<any[]>([]);
  const [filterStation, setFilterStation] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [stations, setStations] = useState<any[]>([]);

  const statusLabels: Record<string, string> = {
    pending: t.pending,
    confirmed: t.confirmed,
    completed: t.completed,
    cancelled: t.cancelled,
    pending_customer_approval: t.pendingCustomerApproval,
  };

  const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    pending: "secondary",
    confirmed: "default",
    completed: "outline",
    cancelled: "destructive",
    pending_customer_approval: "secondary",
  };

  const allowedStatuses = ["pending", "confirmed", "pending_customer_approval", "completed", "cancelled"] as const;

  const normalizeStatus = (status: string | null | undefined) =>
    String(status || "").trim().toLowerCase().replace(/\s+/g, "_");

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

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("bookings").update({ status: status as any }).eq("id", id);
    if (error) {
      toast({ title: t.error, description: error.message, variant: "destructive" });
      return;
    }
    await load();
    toast({ title: t.updated });
  };

  const exportCSV = async () => {
    let q = supabase.from("bookings")
      .select("booking_number, customer_phone, customer_name, booking_date, booking_time, status, created_at, stations(name), services(name, price)")
      .eq("status", "confirmed" as any)
      .order("booking_date", { ascending: false });
    if (filterStation !== "all") q = q.eq("station_id", filterStation);
    if (dateFrom) q = q.gte("booking_date", dateFrom);
    if (dateTo) q = q.lte("booking_date", dateTo);
    const { data, error } = await q;
    if (error) {
      toast({ title: t.exportError, description: error.message, variant: "destructive" });
      return;
    }
    if (!data || data.length === 0) {
      toast({ title: t.noConfirmed, description: t.noConfirmedDesc });
      return;
    }

    const rows = [
      t.csvHeaders,
      ...data.map((b: any) => [
        `#${b.booking_number}`,
        b.customer_name || "",
        b.customer_phone || "",
        (b.stations as any)?.name || "",
        (b.services as any)?.name || "",
        (b.services as any)?.price || "",
        b.booking_date || "",
        b.booking_time?.substring(0, 5) || "",
        b.created_at ? new Date(b.created_at).toLocaleDateString(t.locale) : "",
      ]),
    ];

    const csvContent = "\uFEFF" + rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    ).join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stationName = stations.find((s) => s.id === filterStation)?.name || t.allStationsFile;
    const dateLabel = dateFrom && dateTo ? `${dateFrom}_to_${dateTo}` : new Date().toISOString().split("T")[0];
    link.href = url;
    link.download = `confirmed_bookings_${stationName}_${dateLabel}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: `${t.exportDone}: ${data.length} ${t.exportDoneSuffix}` });
  };

  return (
    <div className="space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-center gap-4">
        <h3 className="text-lg font-semibold text-foreground">{t.title}</h3>
        <Select value={filterStation} onValueChange={setFilterStation}>
          <SelectTrigger className="w-40"><SelectValue placeholder={t.station} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.allStations}</SelectItem>
            {stations.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-52"><SelectValue placeholder={t.status} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.allStatuses}</SelectItem>
            <SelectItem value="pending">{t.pending}</SelectItem>
            <SelectItem value="confirmed">{t.confirmed}</SelectItem>
            <SelectItem value="pending_customer_approval">{t.pendingCustomerApproval}</SelectItem>
            <SelectItem value="completed">{t.completed}</SelectItem>
            <SelectItem value="cancelled">{t.cancelled}</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t.from}</span>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-36" />
          <span className="text-sm text-muted-foreground">{t.to}</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-36" />
        </div>
        <Button onClick={exportCSV} variant="outline">{t.export}</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            {t.headers.map((header) => <TableHead key={header}>{header}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings.map((b) => {
            const normalizedStatus = normalizeStatus(b.status);
            const statusLabel = statusLabels[normalizedStatus] || b.status;
            const statusVariant = statusColors[normalizedStatus] || "secondary";
            const selectStatusValue = normalizedStatus || "pending";

            return (
              <TableRow key={b.id}>
                <TableCell>#{b.booking_number}</TableCell>
                <TableCell>{b.customer_name || b.customer_phone}</TableCell>
                <TableCell>{(b as any).stations?.name}</TableCell>
                <TableCell>{(b as any).services?.name} - {(b as any).services?.price} {t.currency}</TableCell>
                <TableCell>{b.booking_date}</TableCell>
                <TableCell>{b.booking_time?.substring(0, 5) || "-"}</TableCell>
                <TableCell><Badge variant={statusVariant}>{statusLabel}</Badge></TableCell>
                <TableCell>
                  <Select value={selectStatusValue} onValueChange={(v) => updateStatus(b.id, v)}>
                    <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {!allowedStatuses.includes(selectStatusValue as any) && (
                        <SelectItem value={selectStatusValue}>{statusLabel}</SelectItem>
                      )}
                      <SelectItem value="pending">{t.pending}</SelectItem>
                      <SelectItem value="confirmed">{t.confirmed}</SelectItem>
                      <SelectItem value="pending_customer_approval">{t.pendingCustomerApproval}</SelectItem>
                      <SelectItem value="completed">{t.completed}</SelectItem>
                      <SelectItem value="cancelled">{t.cancelled}</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            );
          })}
          {bookings.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">{t.noBookings}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default AdminBookings;
