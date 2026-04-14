import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { StudentSidebar } from "@/components/StudentSidebar";
import logo from "@/assets/logo.png";

export default function StudentLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full" dir="rtl">
        <StudentSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b bg-card px-4 gap-3">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <img src={logo} alt="جهار" className="w-8 h-8 object-contain" />
              <span className="font-heading font-semibold text-foreground">منصة تعلم مركز تدريب جهار</span>
            </div>
          </header>
          <main className="flex-1 p-6 bg-muted/20">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
