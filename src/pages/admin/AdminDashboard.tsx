import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Store, CalendarCheck, TrendingUp, AlertTriangle, Users, CreditCard, Clock, CheckCircle, Hourglass, XCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    activeStations: 0, totalStations: 0,
    todayBookings: 0, pendingBookings: 0, completedBookings: 0, cancelledBookings: 0,
    todayRevenue: 0, weekRevenue: 0, monthRevenue: 0,
    expiringSoon: 0, activeSubscriptions: 0, totalOwners: 0,
  });
  const [weeklyData, setWeeklyData] = useState<{ day: string; bookings: number; revenue: number }[]>([]);
  const [statusData, setStatusData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      // Normalize to Iraq timezone (UTC+3) and use calendar periods.
      const nowIraq = new Date(Date.now() + 3 * 60 * 60 * 1000);
      const today = nowIraq.toISOString().split("T")[0];
      const dayOfWeek = nowIraq.getUTCDay(); // 0=Sunday ... 6=Saturday
      const daysSinceSaturday = (dayOfWeek + 1) % 7;
      const weekStart = new Date(nowIraq.getTime() - daysSinceSaturday * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const monthStart = `${nowIraq.getUTCFullYear()}-${String(nowIraq.getUTCMonth() + 1).padStart(2, "0")}-01`;
      const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const [
        stationsRes, activeStationsRes,
        todayBookingsRes, pendingRes, confirmedRes, completedRes, cancelledRes,
        todayRevenueRes, weekRevenueRes, monthRevenueRes,
        expiringRes, activeSubsRes,
        ownersRes,
      ] = await Promise.all([
        supabase.from("stations").select("id", { count: "exact", head: true }),
        supabase.from("stations").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("bookings").select("id").eq("booking_date", today),
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending" as any),
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "confirmed" as any),
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "completed" as any),
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "cancelled" as any),
        supabase.from("bookings").select("services(price)").eq("booking_date", today).in("status", ["confirmed", "completed"] as any),
        supabase.from("bookings").select("booking_date, services(price)").gte("booking_date", weekStart).lte("booking_date", today).in("status", ["confirmed", "completed"] as any),
        supabase.from("bookings").select("id, services(price)").gte("booking_date", monthStart).lte("booking_date", today).in("status", ["confirmed", "completed"] as any),
        supabase.from("subscriptions").select("id", { count: "exact", head: true }).in("status", ["active", "trial"] as any).lte("end_date", sevenDaysLater),
        supabase.from("subscriptions").select("id", { count: "exact", head: true }).in("status", ["active", "trial"] as any),
        supabase.from("station_owners").select("id", { count: "exact", head: true }),
      ]);

      const todayRevenue = todayRevenueRes.data?.reduce((s: number, b: any) => s + (b.services?.price || 0), 0) || 0;
      const weekRevenue = weekRevenueRes.data?.reduce((s: number, b: any) => s + (b.services?.price || 0), 0) || 0;
      const monthRevenue = monthRevenueRes.data?.reduce((s: number, b: any) => s + (b.services?.price || 0), 0) || 0;

      setStats({
        totalStations: stationsRes.count || 0,
        activeStations: activeStationsRes.count || 0,
        todayBookings: todayBookingsRes.data?.length || 0,
        pendingBookings: pendingRes.count || 0,
        completedBookings: completedRes.count || 0,
        cancelledBookings: cancelledRes.count || 0,
        todayRevenue, weekRevenue, monthRevenue,
        expiringSoon: expiringRes.count || 0,
        activeSubscriptions: activeSubsRes.count || 0,
        totalOwners: ownersRes.count || 0,
      });

      // Build weekly chart data
      const dayMap: Record<string, { bookings: number; revenue: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        dayMap[d] = { bookings: 0, revenue: 0 };
      }
      weekBookingsRes.data?.forEach((b: any) => {
        if (dayMap[b.booking_date]) {
          dayMap[b.booking_date].bookings++;
          dayMap[b.booking_date].revenue += b.services?.price || 0;
        }
      });
      setWeeklyData(Object.entries(dayMap).map(([date, v]) => ({
        day: new Date(date).toLocaleDateString("ar-IQ", { weekday: "short" }),
        bookings: v.bookings,
        revenue: v.revenue,
      })));

      // Booking status pie data
      const p = pendingRes.count || 0;
      const f = confirmedRes.count || 0;
      const c = completedRes.count || 0;
      const x = cancelledRes.count || 0;
      setStatusData([
        { name: "مكتمل", value: c, color: "hsl(var(--primary))" },
        { name: "مؤكد", value: f, color: "hsl(142 71% 45%)" },
        { name: "معلق", value: p, color: "hsl(38 92% 50%)" },
        { name: "ملغي", value: x, color: "hsl(var(--destructive))" },
      ].filter(d => d.value > 0));

      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const summaryCards = [
    { title: "المحطات النشطة", value: `${stats.activeStations} / ${stats.totalStations}`, icon: Store, color: "text-primary", bg: "bg-primary/10" },
    { title: "حجوزات اليوم", value: stats.todayBookings, icon: CalendarCheck, color: "text-primary", bg: "bg-primary/10" },
    { title: "حجوزات معلقة", value: stats.pendingBookings, icon: Hourglass, color: "text-amber-600", bg: "bg-amber-500/10" },
    { title: "إيرادات اليوم", value: `${stats.todayRevenue.toLocaleString()} د.ع`, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { title: "إيرادات الأسبوع", value: `${stats.weekRevenue.toLocaleString()} د.ع`, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { title: "إيرادات الشهر", value: `${stats.monthRevenue.toLocaleString()} د.ع`, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { title: "اشتراكات نشطة", value: stats.activeSubscriptions, icon: CreditCard, color: "text-primary", bg: "bg-primary/10" },
    { title: "تنتهي قريباً", value: stats.expiringSoon, icon: AlertTriangle, color: stats.expiringSoon > 0 ? "text-destructive" : "text-muted-foreground", bg: stats.expiringSoon > 0 ? "bg-destructive/10" : "bg-muted/50" },
    { title: "أصحاب المحطات", value: stats.totalOwners, icon: Users, color: "text-primary", bg: "bg-primary/10" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">لوحة المعلومات</h2>
        <Badge variant="outline" className="text-xs">
          <Clock className="h-3 w-3 ml-1" />
          آخر تحديث: {new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })}
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {summaryCards.map((card, i) => (
          <Card key={i} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">{card.title}</span>
                <div className={`h-9 w-9 rounded-lg ${card.bg} flex items-center justify-center`}>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Weekly Bar Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">الحجوزات والإيرادات — آخر 7 أيام</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis yAxisId="right" orientation="left" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", direction: "rtl" }}
                    formatter={(value: number, name: string) => [
                      name === "revenue" ? `${value.toLocaleString()} د.ع` : value,
                      name === "revenue" ? "الإيرادات" : "الحجوزات"
                    ]}
                  />
                  <Bar yAxisId="left" dataKey="bookings" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="bookings" />
                  <Bar yAxisId="right" dataKey="revenue" fill="hsl(var(--primary) / 0.4)" radius={[4, 4, 0, 0]} name="revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Status Pie Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">حالات الحجوزات</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <div className="h-[280px] w-full flex flex-col items-center justify-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                      {statusData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", direction: "rtl" }}
                      formatter={(value: number, name: string) => [value, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-3 justify-center">
                  {statusData.map((d, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                      {d.name} ({d.value})
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">لا توجد بيانات</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Footer */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "مكتملة", value: stats.completedBookings, icon: CheckCircle, color: "text-emerald-600" },
          { label: "معلقة", value: stats.pendingBookings, icon: Hourglass, color: "text-amber-600" },
          { label: "ملغية", value: stats.cancelledBookings, icon: XCircle, color: "text-destructive" },
          { label: "محطات معطلة", value: stats.totalStations - stats.activeStations, icon: Store, color: "text-muted-foreground" },
        ].map((item, i) => (
          <Card key={i}>
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <item.icon className={`h-5 w-5 ${item.color}`} />
              <div>
                <p className="text-lg font-bold text-foreground">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;
