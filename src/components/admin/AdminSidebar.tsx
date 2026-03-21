import { useState, useEffect } from "react";
import {
  Store, Wrench, CalendarCheck, Users, FileEdit,
  CreditCard, BarChart3, Settings, MessageCircle, LogOut, Car, LayoutDashboard
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

const items = [
  { title: "لوحة المعلومات", url: "/app/admin/dashboard", icon: LayoutDashboard, badgeKey: null },
  { title: "المحطات", url: "/app/admin/stations", icon: Store, badgeKey: null },
  { title: "الخدمات", url: "/app/admin/services", icon: Wrench, badgeKey: null },
  { title: "الحجوزات", url: "/app/admin/bookings", icon: CalendarCheck, badgeKey: "bookings" as const },
  { title: "الحسابات", url: "/app/admin/owners", icon: Users, badgeKey: null },
  { title: "طلبات التعديل", url: "/app/admin/edit-requests", icon: FileEdit, badgeKey: "editRequests" as const },
  { title: "الاشتراكات", url: "/app/admin/subscriptions", icon: CreditCard, badgeKey: null },
  { title: "التقارير", url: "/app/admin/reports", icon: BarChart3, badgeKey: null },
  { title: "الإعدادات", url: "/app/admin/settings", icon: Settings, badgeKey: null },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const [counts, setCounts] = useState({ bookings: 0, editRequests: 0, notifications: 0 });

  useEffect(() => {
    const load = async () => {
      const [bookingsRes, editRes, notifRes] = await Promise.all([
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending" as any),
        supabase.from("edit_requests").select("id", { count: "exact", head: true }).eq("status", "pending" as any),
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("is_read", false),
      ]);
      setCounts({
        bookings: bookingsRes.count || 0,
        editRequests: editRes.count || 0,
        notifications: notifRes.count || 0,
      });
    };
    load();

    // Realtime updates for bookings & edit requests
    const channel = supabase
      .channel("sidebar-counts")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "edit_requests" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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
      {/* Logo / Brand Header */}
      <SidebarHeader className="border-b border-border p-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-sm">
            <Car className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm text-foreground truncate">ChatWhash</span>
              <span className="text-[11px] text-muted-foreground truncate">لوحة التحكم</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>الإدارة</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                    <NavLink to={item.url} end className="hover:bg-accent/50 justify-between" activeClassName="bg-accent text-primary font-medium">
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
              <button onClick={() => navigate("/app/conversations")} className="w-full flex items-center justify-between hover:bg-accent/50">
                <span className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  {!collapsed && <span>المحادثات</span>}
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
              <button onClick={() => supabase.auth.signOut()} className="w-full flex items-center gap-2 hover:bg-destructive/10 text-destructive">
                <LogOut className="h-4 w-4" />
                {!collapsed && <span>تسجيل الخروج</span>}
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
