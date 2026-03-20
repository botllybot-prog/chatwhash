import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { CalendarCheck, DollarSign, TrendingUp, Users } from "lucide-react";

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

const ReportsTab = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [period, setPeriod] = useState("30");

  const load = useCallback(async () => {
    const since = new Date();
    since.setDate(since.getDate() - Number(period));
    const sinceStr = since.toISOString().split("T")[0];

    const [{ data: b }, { data: svc }, { data: st }] = await Promise.all([
      supabase.from("bookings").select("*, services(name, price), stations(name)").gte("booking_date", sinceStr).order("booking_date"),
      supabase.from("services").select("*"),
      supabase.from("stations").select("*"),
    ]);
    if (b) setBookings(b);
    if (svc) setServices(svc);
    if (st) setStations(st);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  // Stats
  const totalBookings = bookings.length;
  const totalRevenue = bookings.reduce((sum, b) => sum + ((b as any).services?.price || 0), 0);
  const completedBookings = bookings.filter(b => b.status === "completed").length;
  const uniqueCustomers = new Set(bookings.map(b => b.customer_phone)).size;

  // Daily bookings chart
  const dailyMap: Record<string, number> = {};
  bookings.forEach(b => {
    dailyMap[b.booking_date] = (dailyMap[b.booking_date] || 0) + 1;
  });
  const dailyData = Object.entries(dailyMap).sort().slice(-14).map(([date, count]) => ({
    date: date.substring(5),
    عدد: count,
  }));

  // Top services
  const serviceCount: Record<string, { name: string; count: number; revenue: number }> = {};
  bookings.forEach(b => {
    const name = (b as any).services?.name || "غير معروف";
    const price = (b as any).services?.price || 0;
    if (!serviceCount[name]) serviceCount[name] = { name, count: 0, revenue: 0 };
    serviceCount[name].count++;
    serviceCount[name].revenue += price;
  });
  const topServices = Object.values(serviceCount).sort((a, b) => b.count - a.count);

  // Station distribution
  const stationCount: Record<string, { name: string; count: number }> = {};
  bookings.forEach(b => {
    const name = (b as any).stations?.name || "غير معروف";
    if (!stationCount[name]) stationCount[name] = { name, count: 0 };
    stationCount[name].count++;
  });
  const stationData = Object.values(stationCount).sort((a, b) => b.count - a.count);

  // Status breakdown
  const statusLabels: Record<string, string> = { pending: "قيد الانتظار", confirmed: "مؤكد", completed: "مكتمل", cancelled: "ملغي" };
  const statusCount: Record<string, number> = {};
  bookings.forEach(b => {
    statusCount[b.status] = (statusCount[b.status] || 0) + 1;
  });
  const statusData = Object.entries(statusCount).map(([status, count]) => ({
    name: statusLabels[status] || status,
    value: count,
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-foreground">التقارير والإحصائيات</h3>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">آخر 7 أيام</SelectItem>
            <SelectItem value="30">آخر 30 يوم</SelectItem>
            <SelectItem value="90">آخر 3 أشهر</SelectItem>
            <SelectItem value="365">آخر سنة</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><CalendarCheck className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الحجوزات</p>
                <p className="text-2xl font-bold text-foreground">{totalBookings}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><DollarSign className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-sm text-muted-foreground">الإيرادات</p>
                <p className="text-2xl font-bold text-foreground">{totalRevenue} ريال</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><TrendingUp className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-sm text-muted-foreground">مكتملة</p>
                <p className="text-2xl font-bold text-foreground">{completedBookings}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-sm text-muted-foreground">عملاء فريدون</p>
                <p className="text-2xl font-bold text-foreground">{uniqueCustomers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Daily Bookings Chart */}
        <Card>
          <CardHeader><CardTitle className="text-base">الحجوزات اليومية</CardTitle></CardHeader>
          <CardContent>
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" fontSize={12} stroke="hsl(var(--muted-foreground))" />
                  <YAxis fontSize={12} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                  <Bar dataKey="عدد" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-12">لا توجد بيانات</p>
            )}
          </CardContent>
        </Card>

        {/* Status Pie */}
        <Card>
          <CardHeader><CardTitle className="text-base">توزيع الحالات</CardTitle></CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} fontSize={12}>
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-12">لا توجد بيانات</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Services & Stations */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">أكثر الخدمات طلباً</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>الخدمة</TableHead><TableHead>الحجوزات</TableHead><TableHead>الإيرادات</TableHead></TableRow></TableHeader>
              <TableBody>
                {topServices.map((s, i) => (
                  <TableRow key={s.name}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {i === 0 && <Badge className="text-xs">الأول</Badge>}
                        {s.name}
                      </div>
                    </TableCell>
                    <TableCell>{s.count}</TableCell>
                    <TableCell>{s.revenue} ريال</TableCell>
                  </TableRow>
                ))}
                {topServices.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">لا توجد بيانات</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">توزيع الحجوزات بالمحطات</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>المحطة</TableHead><TableHead>الحجوزات</TableHead><TableHead>النسبة</TableHead></TableRow></TableHeader>
              <TableBody>
                {stationData.map(s => (
                  <TableRow key={s.name}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.count}</TableCell>
                    <TableCell>{totalBookings > 0 ? ((s.count / totalBookings) * 100).toFixed(0) : 0}%</TableCell>
                  </TableRow>
                ))}
                {stationData.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">لا توجد بيانات</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReportsTab;
