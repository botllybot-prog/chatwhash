import { useState, useEffect } from "react";
import {
  Store, Wrench, CalendarCheck, Users, FileEdit,
  CreditCard, BarChart3, Settings, MessageCircle, LogOut, Car, LayoutDashboard, UserCheck, Briefcase, Megaphone,
  Star,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { useAppLanguage } from "@/lib/language";

const sidebarTexts = {
  ar: {
    brandSub: "لوحة التحكم",
    management: "الإدارة",
    dashboard: "لوحة المعلومات",
    stations: "المحطات",
    services: "الخدمات",
    bookings: "الحجوزات",
    owners: "الحسابات",
    customers: "عملاء البوت",
    ratings: "تقييمات الغسل",
    editRequests: "طلبات التعديل",
    subscriptions: "الاشتراكات",
    reports: "التقارير",
    settings: "الإعدادات",
    employees: "الموظفون",
    broadcast: "رسائل جماعية",
    conversations: "المحادثات",
    logout: "تسجيل الخروج",
  },
  en: {
    brandSub: "Dashboard",
    management: "Management",
    dashboard: "Dashboard",
    stations: "Stations",
    services: "Services",
    bookings: "Bookings",
    owners: "Accounts",
    customers: "Bot customers",
    ratings: "Wash ratings",
    editRequests: "Edit requests",
    subscriptions: "Subscriptions",
    reports: "Reports",
    settings: "Settings",
    employees: "Employees",
    broadcast: "Broadcast",
    conversations: "Conversations",
    logout: "Log out",
  },
  ku: {
    brandSub: "داشبۆرد",
    management: "بەڕێوەبردن",
    dashboard: "داشبۆرد",
    stations: "وێستگەکان",
    services: "خزمەتگوزاریەکان",
    bookings: "حجزەکان",
    owners: "هەژمارەکان",
    customers: "کڕیارانی بۆت",
    ratings: "هەڵسەنگاندنەکان",
    editRequests: "داواکاری دەستکاری",
    subscriptions: "بەشدارییەکان",
    reports: "ڕاپۆرتەکان",
    settings: "ڕێکخستنەکان",
    employees: "کارمەندەکان",
    broadcast: "نامەی گشتی",
    conversations: "گفتوگۆکان",
    logout: "چوونەدەرەوە",
  },
  tr: {
    brandSub: "Yönetim paneli",
    management: "Yönetim",
    dashboard: "Panel",
    stations: "İstasyonlar",
    services: "Hizmetler",
    bookings: "Rezervasyonlar",
    owners: "Hesaplar",
    customers: "Bot müşterileri",
    ratings: "Yıkama puanları",
    editRequests: "Düzenleme talepleri",
    subscriptions: "Abonelikler",
    reports: "Raporlar",
    settings: "Ayarlar",
    employees: "Çalışanlar",
    broadcast: "Toplu mesaj",
    conversations: "Konuşmalar",
    logout: "Çıkış yap",
  },
} as const;

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { language } = useAppLanguage();
  const t = sidebarTexts[language];

  const items = [
    { title: t.dashboard, url: "/app/admin/dashboard", icon: LayoutDashboard, badgeKey: null },
    { title: t.stations, url: "/app/admin/stations", icon: Store, badgeKey: null },
    { title: t.services, url: "/app/admin/services", icon: Wrench, badgeKey: null },
    { title: t.bookings, url: "/app/admin/bookings", icon: CalendarCheck, badgeKey: "bookings" as const },
    { title: t.owners, url: "/app/admin/owners", icon: Users, badgeKey: null },
    { title: t.customers, url: "/app/admin/customers", icon: UserCheck, badgeKey: null },
    { title: t.ratings, url: "/app/admin/ratings", icon: Star, badgeKey: null },
    { title: t.editRequests, url: "/app/admin/edit-requests", icon: FileEdit, badgeKey: "editRequests" as const },
    { title: t.subscriptions, url: "/app/admin/subscriptions", icon: CreditCard, badgeKey: null },
    { title: t.reports, url: "/app/admin/reports", icon: BarChart3, badgeKey: null },
    { title: t.settings, url: "/app/admin/settings", icon: Settings, badgeKey: null },
    { title: t.employees, url: "/app/admin/employees", icon: Briefcase, badgeKey: null },
    { title: t.broadcast, url: "/app/admin/broadcast", icon: Megaphone, badgeKey: null },
  ];

  const [counts, setCounts] = useState({ bookings: 0, editRequests: 0, notifications: 0 });

  useEffect(() => {
    const load = async () => {
      const [bookingsRes, editRes, notifRes] = await Promise.all([
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending" as never),
        supabase.from("edit_requests").select("id", { count: "exact", head: true }).eq("status", "pending" as never),
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("is_read", false),
      ]);

      setCounts({
        bookings: bookingsRes.count || 0,
        editRequests: editRes.count || 0,
        notifications: notifRes.count || 0,
      });
    };

    load();

    const channel = supabase
      .channel("sidebar-counts")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "edit_requests" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getBadge = (key: "bookings" | "editRequests" | null) => {
    if (!key) return null;
    const count = counts[key];
    if (count === 0) return null;

    return (
      <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px] font-bold leading-none">
        {count > 99 ? "99+" : count}
      </Badge>
    );
  };

  return (
    <Sidebar collapsible="icon" side="right" className="border-l border-border">
      <SidebarHeader className="border-b border-border p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary shadow-sm">
            <Car className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-bold text-foreground">ChatWhash</span>
              <span className="truncate text-[11px] text-muted-foreground">{t.brandSub}</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t.management}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                    <NavLink to={item.url} end className="justify-between hover:bg-accent/50" activeClassName="bg-accent text-primary font-medium">
                      <span className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </span>
                      {!collapsed && getBadge(item.badgeKey)}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <button onClick={() => navigate("/app/conversations")} className="flex w-full items-center justify-between hover:bg-accent/50">
                <span className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  {!collapsed && <span>{t.conversations}</span>}
                </span>
                {!collapsed && counts.notifications > 0 && (
                  <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px] font-bold leading-none">
                    {counts.notifications > 99 ? "99+" : counts.notifications}
                  </Badge>
                )}
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <button onClick={() => supabase.auth.signOut()} className="flex w-full items-center gap-2 text-destructive hover:bg-destructive/10">
                <LogOut className="h-4 w-4" />
                {!collapsed && <span>{t.logout}</span>}
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
