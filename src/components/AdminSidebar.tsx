import { LayoutDashboard, Video, Users, BarChart3, LogOut, BookOpen, ShieldCheck, ClipboardList, PieChart } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const items = [
  { title: "لوحة التحكم", url: "/admin", icon: LayoutDashboard },
  { title: "الكورسات", url: "/admin/courses", icon: BookOpen },
  { title: "المحاضرات", url: "/admin/lectures", icon: Video },
  { title: "الطلاب", url: "/admin/students", icon: Users },
  { title: "الاختبارات", url: "/admin/quizzes", icon: ClipboardList },
  { title: "ملخص الاختبارات", url: "/admin/quiz-summary", icon: PieChart },
  { title: "التقارير", url: "/admin/reports", icon: BarChart3 },
  { title: "حساب المسؤول", url: "/admin/account", icon: ShieldCheck },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut } = useAuth();

  return (
    <Sidebar collapsible="icon" side="right">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="font-heading">إدارة المنصة</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-primary font-medium">
                      <item.icon className="ml-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start text-muted-foreground">
          <LogOut className="ml-2 h-4 w-4" />
          {!collapsed && "تسجيل الخروج"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
