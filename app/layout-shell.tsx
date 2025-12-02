import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/app-sidebar";
import { ReactNode } from "react";

export default function LayoutShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="relative flex h-screen w-full">
        <DashboardSidebar />
        <SidebarInset className="flex flex-col p-5">{children}</SidebarInset>
      </div>
    </SidebarProvider>
  );
}
