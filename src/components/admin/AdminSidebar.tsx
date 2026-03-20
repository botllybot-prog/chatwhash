import {
  Store, Wrench, CalendarCheck, Users, FileEdit,
  CreditCard, BarChart3, Settings, MessageCircle, LogOut, Car
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const items = [
  { title: "المحطات", url: "/app/admin/stations", icon: Store },
  { title: "الخدمات", url: "/app/admin/services", icon: Wrench },
  { title: "الحجوزات", url: "/app/admin/bookings", icon: CalendarCheck },
  { title: "الحسابات", url: "/app/admin/owners", icon: Users },
  { title: "طلبات التعديل", url: "/app/admin/edit-requests", icon: FileEdit },
  { title: "الاشتراكات", url: "/app/admin/subscriptions", icon: CreditCard },
  { title: "التقارير", url: "/app/admin/reports", icon: BarChart3 },
  { title: "الإعدادات", url: "/app/admin/settings", icon: Settings },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Sidebar collapsible="icon" side="right" className="border-l border-border">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="gap-2">
            <Car className="h-4 w-4" />
            {!collapsed && <span className="font-cairo font-bold">لوحة التحكم</span>}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                    <NavLink to={item.url} end className="hover:bg-accent/50" activeClassName="bg-accent text-primary font-medium">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
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
              <button onClick={() => navigate("/app/conversations")} className="w-full flex items-center gap-2 hover:bg-accent/50">
                <MessageCircle className="h-4 w-4" />
                {!collapsed && <span>المحادثات</span>}
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
