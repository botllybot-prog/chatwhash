import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Store, CalendarCheck, TrendingUp, AlertTriangle, Users, CreditCard, Clock, CheckCircle, Hourglass, XCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useAppLanguage } from "@/lib/language";

const texts = {
  ar: {
    dashboard: "لوحة المعلومات",
    lastUpdate: "آخر تحديث",
    activeStations: "المحطات النشطة",
    todayBookings: "حجوزات اليوم",
    pendingBookings: "حجوزات معلقة",
    todayRevenue: "إيرادات اليوم",
    weekRevenue: "إيرادات الأسبوع",
    monthRevenue: "إيرادات الشهر",
    activeSubscriptions: "اشتراكات نشطة",
    expiringSoon: "تنتهي قريباً",
    stationOwners: "أصحاب المحطات",
    last7Days: "الحجوزات والإيرادات - آخر 7 أيام",
    bookingStatuses: "حالات الحجوزات",
    noData: "لا توجد بيانات",
    completed: "مكتملة",
    confirmed: "مؤكدة",
    pending: "معلقة",
    cancelled: "ملغية",
    disabledStations: "محطات معطلة",
    bookingsLegend: "الحجوزات",
    revenueLegend: "الإيرادات",
    currency: "د.ع",
    loading: "جاري تحميل لوحة المعلومات...",
    dayShortLocale: "ar-IQ",
    timeLocale: "ar-IQ",
  },
  en: {
    dashboard: "Dashboard",
    lastUpdate: "Last update",
    activeStations: "Active stations",
    todayBookings: "Today's bookings",
    pendingBookings: "Pending bookings",
    todayRevenue: "Today's revenue",
    weekRevenue: "Weekly revenue",
    monthRevenue: "Monthly revenue",
    activeSubscriptions: "Active subscriptions",
    expiringSoon: "Expiring soon",
    stationOwners: "Station owners",
    last7Days: "Bookings and revenue - last 7 days",
    bookingStatuses: "Booking statuses",
    noData: "No data available",
    completed: "Completed",
    confirmed: "Confirmed",
    pending: "Pending",
    cancelled: "Cancelled",
    disabledStations: "Disabled stations",
    bookingsLegend: "Bookings",
    revenueLegend: "Revenue",
    currency: "IQD",
    loading: "Loading dashboard...",
    dayShortLocale: "en-US",
    timeLocale: "en-US",
  },
  ku: {
    dashboard: "داشبۆرد",
    lastUpdate: "دوایین نوێکردنەوە",
    activeStations: "وێستگە چالاکەکان",
    todayBookings: "حجزەکانی ئەمڕۆ",
    pendingBookings: "حجزە هەڵپەسێردراوەکان",
    todayRevenue: "داهاتی ئەمڕۆ",
    weekRevenue: "داهاتی هەفتە",
    monthRevenue: "داهاتی مانگ",
    activeSubscriptions: "بەشداریکردنی چالاک",
    expiringSoon: "بەزوویی کۆتایی دێت",
    stationOwners: "خاوەن وێستگەکان",
    last7Days: "حجز و داهات - ٧ ڕۆژی دوایین",
    bookingStatuses: "دۆخی حجزەکان",
    noData: "هیچ زانیارییەک نییە",
    completed: "تەواوبوو",
    confirmed: "پشتڕاستکراوە",
    pending: "چاوەڕوان",
    cancelled: "هەڵوەشایەوە",
    disabledStations: "وێستگە ناچالاکەکان",
    bookingsLegend: "حجزەکان",
    revenueLegend: "داهات",
    currency: "د.ع",
    loading: "داشبۆرد بار دەکرێت...",
    dayShortLocale: "ku",
    timeLocale: "ku",
  },
  tr: {
    dashboard: "Kontrol paneli",
    lastUpdate: "Son güncelleme",
    activeStations: "Aktif istasyonlar",
    todayBookings: "Bugünkü rezervasyonlar",
    pendingBookings: "Bekleyen rezervasyonlar",
    todayRevenue: "Bugünkü gelir",
    weekRevenue: "Haftalık gelir",
    monthRevenue: "Aylık gelir",
    activeSubscriptions: "Aktif abonelikler",
    expiringSoon: "Yakında bitecek",
    stationOwners: "İstasyon sahipleri",
    last7Days: "Rezervasyonlar ve gelir - son 7 gün",
    bookingStatuses: "Rezervasyon durumları",
    noData: "Veri yok",
    completed: "Tamamlandı",
    confirmed: "Onaylandı",
    pending: "Beklemede",
    cancelled: "İptal edildi",
    disabledStations: "Pasif istasyonlar",
    bookingsLegend: "Rezervasyonlar",
    revenueLegend: "Gelir",
    currency: "IQD",
    loading: "Panel yükleniyor...",
    dayShortLocale: "tr-TR",
    timeLocale: "tr-TR",
  },
} as const;

const AdminDashboard = () => {
  const { language } = useAppLanguage();
  const t = texts[language];
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
      try {
        const nowIraq = new Date(Date.now() + 3 * 60 * 60 * 1000);
        const today = nowIraq.toISOString().split("T")[0];
        const dayOfWeek = nowIraq.getUTCDay();
        const daysSinceSaturday = (dayOfWeek + 1) % 7;
        const weekStart = new Date(nowIraq.getTime() - daysSinceSaturday * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const monthStart = `${nowIraq.getUTCFullYear()}-${String(nowIraq.getUTCMonth() + 1).padStart(2, "0")}-01`;
        const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

        const [
          stationsRes, activeStationsRes,
          todayBookingsRes, pendingRes, confirmedRes, completedRes, cancelledRes,
          todayRevenueRes, weekBookingsRes, monthRevenueRes,
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

        const todayRevenue = todayRevenueRes.data?.reduce((sum: number, booking: any) => sum + (booking.services?.price || 0), 0) || 0;
        const weekRevenue = weekBookingsRes.data?.reduce((sum: number, booking: any) => sum + (booking.services?.price || 0), 0) || 0;
        const monthRevenue = monthRevenueRes.data?.reduce((sum: number, booking: any) => sum + (booking.services?.price || 0), 0) || 0;

        setStats({
          totalStations: stationsRes.count || 0,
          activeStations: activeStationsRes.count || 0,
          todayBookings: todayBookingsRes.data?.length || 0,
          pendingBookings: pendingRes.count || 0,
          completedBookings: completedRes.count || 0,
          cancelledBookings: cancelledRes.count || 0,
          todayRevenue,
          weekRevenue,
          monthRevenue,
          expiringSoon: expiringRes.count || 0,
          activeSubscriptions: activeSubsRes.count || 0,
          totalOwners: ownersRes.count || 0,
        });

        const dayMap: Record<string, { bookings: number; revenue: number }> = {};
        for (let i = 6; i >= 0; i--) {
          const day = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
          dayMap[day] = { bookings: 0, revenue: 0 };
        }

        weekBookingsRes.data?.forEach((booking: any) => {
          if (dayMap[booking.booking_date]) {
            dayMap[booking.booking_date].bookings += 1;
            dayMap[booking.booking_date].revenue += booking.services?.price || 0;
          }
        });

        setWeeklyData(
          Object.entries(dayMap).map(([date, value]) => ({
            day: new Date(date).toLocaleDateString(t.dayShortLocale, { weekday: "short" }),
            bookings: value.bookings,
            revenue: value.revenue,
          })),
        );

        const pending = pendingRes.count || 0;
        const confirmed = confirmedRes.count || 0;
        const completed = completedRes.count || 0;
        const cancelled = cancelledRes.count || 0;

        setStatusData([
          { name: t.completed, value: completed, color: "hsl(var(--primary))" },
          { name: t.confirmed, value: confirmed, color: "hsl(142 71% 45%)" },
          { name: t.pending, value: pending, color: "hsl(38 92% 50%)" },
          { name: t.cancelled, value: cancelled, color: "hsl(var(--destructive))" },
        ].filter((item) => item.value > 0));
      } catch (error) {
        console.error("Admin dashboard load failed", error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [t.cancelled, t.completed, t.confirmed, t.dayShortLocale, t.pending]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        <span className="mr-3 text-sm text-muted-foreground">{t.loading}</span>
      </div>
    );
  }

  const summaryCards = [
    { title: t.activeStations, value: `${stats.activeStations} / ${stats.totalStations}`, icon: Store, color: "text-primary", bg: "bg-primary/10" },
    { title: t.todayBookings, value: stats.todayBookings, icon: CalendarCheck, color: "text-primary", bg: "bg-primary/10" },
    { title: t.pendingBookings, value: stats.pendingBookings, icon: Hourglass, color: "text-amber-600", bg: "bg-amber-500/10" },
    { title: t.todayRevenue, value: `${stats.todayRevenue.toLocaleString()} ${t.currency}`, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { title: t.weekRevenue, value: `${stats.weekRevenue.toLocaleString()} ${t.currency}`, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { title: t.monthRevenue, value: `${stats.monthRevenue.toLocaleString()} ${t.currency}`, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { title: t.activeSubscriptions, value: stats.activeSubscriptions, icon: CreditCard, color: "text-primary", bg: "bg-primary/10" },
    { title: t.expiringSoon, value: stats.expiringSoon, icon: AlertTriangle, color: stats.expiringSoon > 0 ? "text-destructive" : "text-muted-foreground", bg: stats.expiringSoon > 0 ? "bg-destructive/10" : "bg-muted/50" },
    { title: t.stationOwners, value: stats.totalOwners, icon: Users, color: "text-primary", bg: "bg-primary/10" },
  ];

  const quickStats = [
    { label: t.completed, value: stats.completedBookings, icon: CheckCircle, color: "text-emerald-600" },
    { label: t.pending, value: stats.pendingBookings, icon: Hourglass, color: "text-amber-600" },
    { label: t.cancelled, value: stats.cancelledBookings, icon: XCircle, color: "text-destructive" },
    { label: t.disabledStations, value: stats.totalStations - stats.activeStations, icon: Store, color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">{t.dashboard}</h2>
        <Badge variant="outline" className="text-xs">
          <Clock className="h-3 w-3 ml-1" />
          {t.lastUpdate}: {new Date().toLocaleTimeString(t.timeLocale, { hour: "2-digit", minute: "2-digit" })}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {summaryCards.map((card, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.last7Days}</CardTitle>
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
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                    formatter={(value: number, name: string) => [
                      name === "revenue" ? `${value.toLocaleString()} ${t.currency}` : value,
                      name === "revenue" ? t.revenueLegend : t.bookingsLegend,
                    ]}
                  />
                  <Bar yAxisId="left" dataKey="bookings" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="bookings" />
                  <Bar yAxisId="right" dataKey="revenue" fill="hsl(var(--primary) / 0.4)" radius={[4, 4, 0, 0]} name="revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.bookingStatuses}</CardTitle>
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
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                      formatter={(value: number, name: string) => [value, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-3 justify-center">
                  {statusData.map((item, index) => (
                    <div key={index} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.name} ({item.value})
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">{t.noData}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {quickStats.map((item, index) => (
          <Card key={index}>
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
