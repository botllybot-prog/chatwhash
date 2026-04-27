import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { CalendarCheck, DollarSign, TrendingUp, Users, Download, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { useAppLanguage } from "@/lib/language";

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

const texts = {
  ar: { title: "???????? ???????????", csv: "????? CSV", excel: "????? Excel", days7: "??? 7 ????", days30: "??? 30 ???", days90: "??? 3 ????", days365: "??? ???", totalBookings: "?????? ????????", revenue: "?????????", completed: "??????", customers: "????? ??????", daily: "???????? ???????", statusDist: "????? ???????", topServices: "???? ??????? ?????", stationDist: "????? ???????? ????????", service: "??????", station: "??????", bookings: "????????", amount: "?????????", ratio: "??????", noData: "?? ???? ??????", summary: "????", report: "???????", amountIqd: "????????? (?.?)", stationName: "??????", bookingNumber: "??? ?????", customerPhone: "??? ??????", customerName: "??? ??????", date: "???????", time: "?????", status: "??????", unknown: "??? ?????", pending: "??? ????????", confirmed: "????", cancelled: "????", basicName: "????????", summaryName: "????", first: "?????" },
  en: { title: "Reports and analytics", csv: "Export CSV", excel: "Export Excel", days7: "Last 7 days", days30: "Last 30 days", days90: "Last 3 months", days365: "Last year", totalBookings: "Total bookings", revenue: "Revenue", completed: "Completed", customers: "Unique customers", daily: "Daily bookings", statusDist: "Status distribution", topServices: "Top services", stationDist: "Bookings by station", service: "Service", station: "Station", bookings: "Bookings", amount: "Revenue", ratio: "Ratio", noData: "No data", summary: "Summary", report: "Report", amountIqd: "Revenue (IQD)", stationName: "Station", bookingNumber: "Booking #", customerPhone: "Customer phone", customerName: "Customer name", date: "Date", time: "Time", status: "Status", unknown: "Unknown", pending: "Pending", confirmed: "Confirmed", cancelled: "Cancelled", basicName: "Bookings", summaryName: "Summary", first: "Top" },
  ku: { title: "?????? ? ?????????", csv: "?????? CSV", excel: "?????? Excel", days7: "?????? 7 ???", days30: "?????? 30 ???", days90: "?????? 3 ????", days365: "?????? ???", totalBookings: "??? ???????", revenue: "?????", completed: "????????", customers: "???????? ??????", daily: "???? ?????????", statusDist: "?????????? ???????", topServices: "??????? ??????????? ????????", stationDist: "?????????? ??????? ????? ?????????", service: "???????????", station: "??????", bookings: "???????", amount: "?????", ratio: "????", noData: "??? ??????? ????", summary: "?????", report: "??????", amountIqd: "????? (?.?)", stationName: "??????", bookingNumber: "?????? ???", customerPhone: "?????? ?????", customerName: "???? ?????", date: "??????", time: "???", status: "???", unknown: "????????", pending: "????????", confirmed: "????????????", cancelled: "?????????", basicName: "???????", summaryName: "?????", first: "?????" },
  tr: { title: "Raporlar ve analizler", csv: "CSV disa aktar", excel: "Excel disa aktar", days7: "Son 7 gün", days30: "Son 30 gün", days90: "Son 3 ay", days365: "Son yil", totalBookings: "Toplam rezervasyon", revenue: "Gelir", completed: "Tamamlanan", customers: "Benzersiz müsteriler", daily: "Günlük rezervasyonlar", statusDist: "Durum dagilimi", topServices: "En çok talep edilen hizmetler", stationDist: "Istasyona göre rezervasyon", service: "Hizmet", station: "Istasyon", bookings: "Rezervasyonlar", amount: "Gelir", ratio: "Oran", noData: "Veri yok", summary: "Özet", report: "Rapor", amountIqd: "Gelir (IQD)", stationName: "Istasyon", bookingNumber: "Rezervasyon #", customerPhone: "Müsteri telefonu", customerName: "Müsteri adi", date: "Tarih", time: "Saat", status: "Durum", unknown: "Bilinmiyor", pending: "Beklemede", confirmed: "Onaylandi", cancelled: "Iptal edildi", basicName: "Rezervasyonlar", summaryName: "Özet", first: "Birinci" },
} as const;

const ReportsTab = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [period, setPeriod] = useState("30");
  const { language } = useAppLanguage();
  const t = texts[language];

  const load = useCallback(async () => {
    const since = new Date();
    since.setDate(since.getDate() - Number(period));
    const sinceStr = since.toISOString().split("T")[0];
    const { data } = await supabase.from("bookings").select("*, services(name, price), stations(name)").gte("booking_date", sinceStr).order("booking_date");
    if (data) setBookings(data);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const statusLabels: Record<string, string> = { pending: t.pending, confirmed: t.confirmed, completed: t.completed, cancelled: t.cancelled };
  const totalBookings = bookings.length;
  const revenueBookings = bookings.filter((b) => b.status === "confirmed" || b.status === "completed");
  const totalRevenue = revenueBookings.reduce((sum, b) => sum + ((b as any).services?.price || 0), 0);
  const completedBookings = bookings.filter((b) => b.status === "completed").length;
  const uniqueCustomers = new Set(bookings.map((b) => b.customer_phone)).size;

  const dailyMap: Record<string, number> = {};
  bookings.forEach((b) => { dailyMap[b.booking_date] = (dailyMap[b.booking_date] || 0) + 1; });
  const dailyData = Object.entries(dailyMap).sort().slice(-14).map(([date, count]) => ({ date: date.substring(5), count }));

  const serviceCount: Record<string, { name: string; count: number; revenue: number }> = {};
  bookings.forEach((b) => {
    const name = (b as any).services?.name || t.unknown;
    const price = (b as any).services?.price || 0;
    if (!serviceCount[name]) serviceCount[name] = { name, count: 0, revenue: 0 };
    serviceCount[name].count++;
    serviceCount[name].revenue += price;
  });
  const topServices = Object.values(serviceCount).sort((a, b) => b.count - a.count);

  const stationCount: Record<string, { name: string; count: number }> = {};
  bookings.forEach((b) => {
    const name = (b as any).stations?.name || t.unknown;
    if (!stationCount[name]) stationCount[name] = { name, count: 0 };
    stationCount[name].count++;
  });
  const stationData = Object.values(stationCount).sort((a, b) => b.count - a.count);

  const statusCount: Record<string, number> = {};
  bookings.forEach((b) => { statusCount[b.status] = (statusCount[b.status] || 0) + 1; });
  const statusData = Object.entries(statusCount).map(([status, count]) => ({ name: statusLabels[status] || status, value: count }));

  const getExportRows = () => bookings.map((b) => ({ [t.bookingNumber]: b.booking_number, [t.customerPhone]: b.customer_phone, [t.customerName]: b.customer_name || "-", [t.stationName]: (b as any).stations?.name || "-", [t.service]: (b as any).services?.name || "-", [t.amountIqd]: (b as any).services?.price || 0, [t.date]: b.booking_date, [t.time]: b.booking_time?.substring(0, 5) || "-", [t.status]: statusLabels[b.status] || b.status }));

  const exportCSV = () => {
    const rows = getExportRows();
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => headers.map((h) => `"${(r as any)[h]}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const rows = getExportRows();
    if (rows.length === 0) return;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = Object.keys(rows[0]).map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, t.basicName);
    const summaryData = [[t.report, period], [t.totalBookings, totalBookings], [t.amountIqd, totalRevenue], [t.completed, completedBookings], [t.customers, uniqueCustomers]];
    const ws2 = XLSX.utils.aoa_to_sheet(summaryData);
    ws2["!cols"] = [{ wch: 25 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws2, t.summaryName);
    XLSX.writeFile(wb, `report_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3"><h3 className="text-lg font-semibold text-foreground">{t.title}</h3><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={exportCSV} disabled={bookings.length === 0}><Download className="h-4 w-4 ml-1" />{t.csv}</Button><Button variant="outline" size="sm" onClick={exportExcel} disabled={bookings.length === 0}><FileSpreadsheet className="h-4 w-4 ml-1" />{t.excel}</Button><Select value={period} onValueChange={setPeriod}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">{t.days7}</SelectItem><SelectItem value="30">{t.days30}</SelectItem><SelectItem value="90">{t.days90}</SelectItem><SelectItem value="365">{t.days365}</SelectItem></SelectContent></Select></div></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[{ icon: CalendarCheck, label: t.totalBookings, value: totalBookings }, { icon: DollarSign, label: t.revenue, value: `${totalRevenue} ?.?` }, { icon: TrendingUp, label: t.completed, value: completedBookings }, { icon: Users, label: t.customers, value: uniqueCustomers }].map((item) => <Card key={item.label}><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-primary/10"><item.icon className="h-5 w-5 text-primary" /></div><div><p className="text-sm text-muted-foreground">{item.label}</p><p className="text-2xl font-bold text-foreground">{item.value}</p></div></div></CardContent></Card>)}</div>
      <div className="grid md:grid-cols-2 gap-6">
        <Card><CardHeader><CardTitle className="text-base">{t.daily}</CardTitle></CardHeader><CardContent>{dailyData.length > 0 ? <ResponsiveContainer width="100%" height={250}><BarChart data={dailyData}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="date" fontSize={12} stroke="hsl(var(--muted-foreground))" /><YAxis fontSize={12} stroke="hsl(var(--muted-foreground))" /><Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} /><Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <p className="text-center text-muted-foreground py-12">{t.noData}</p>}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">{t.statusDist}</CardTitle></CardHeader><CardContent>{statusData.length > 0 ? <ResponsiveContainer width="100%" height={250}><PieChart><Pie data={statusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} fontSize={12}>{statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} /></PieChart></ResponsiveContainer> : <p className="text-center text-muted-foreground py-12">{t.noData}</p>}</CardContent></Card>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <Card><CardHeader><CardTitle className="text-base">{t.topServices}</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>{t.service}</TableHead><TableHead>{t.bookings}</TableHead><TableHead>{t.amount}</TableHead></TableRow></TableHeader><TableBody>{topServices.map((s, i) => <TableRow key={s.name}><TableCell className="font-medium"><div className="flex items-center gap-2">{i === 0 && <Badge className="text-xs">{t.first}</Badge>}{s.name}</div></TableCell><TableCell>{s.count}</TableCell><TableCell>{s.revenue}</TableCell></TableRow>)}{topServices.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">{t.noData}</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">{t.stationDist}</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>{t.station}</TableHead><TableHead>{t.bookings}</TableHead><TableHead>{t.ratio}</TableHead></TableRow></TableHeader><TableBody>{stationData.map((s) => <TableRow key={s.name}><TableCell className="font-medium">{s.name}</TableCell><TableCell>{s.count}</TableCell><TableCell>{totalBookings > 0 ? ((s.count / totalBookings) * 100).toFixed(0) : 0}%</TableCell></TableRow>)}{stationData.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">{t.noData}</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
      </div>
    </div>
  );
};

export default ReportsTab;
