import DashboardSidebar from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ReactNode } from "react";

export default function LayoutShell({ children, data }: { children: ReactNode, data: any }) {
  return (
    <SidebarProvider>
      <div className="relative flex h-screen w-full">
        <DashboardSidebar data={data} />
        <SidebarInset className="flex flex-col p-5">{children}</SidebarInset>
      </div>
    </SidebarProvider>
  );
}
