"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
  useSidebar,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Book, Home, Search, User, ChevronsUpDown } from "lucide-react";
import { Logo } from "./logo";
import type { Route } from "./nav-main";
import DashboardNavigation from "./nav-main";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { LogoutButton } from "./logout";

/**
 * Helper to normalize various shapes that `data` can have so the UI always
 * renders the user's email when available.
 *
 * Possible shapes observed across the app:
 * - claims object (passed from server as `data?.claims`) -> { email?: string }
 * - supabase session-like object -> { user?: { email?: string, user_metadata?: { email?: string } } }
 * - top-level email property -> { email?: string }
 *
 * This function checks known locations in a predictable order and returns the
 * first string it finds (or undefined).
 */
function getEmailFromData(data: any): string | undefined {
  if (!data) return undefined;

  // Direct email on the object (e.g., claims)
  if (typeof data.email === "string" && data.email.length > 0) {
    return data.email;
  }

  // Supabase-like user shape: data.user.email
  if (typeof data.user?.email === "string" && data.user.email.length > 0) {
    return data.user.email;
  }

  // Some shapes might nest claims under `claims`
  if (typeof data.claims?.email === "string" && data.claims.email.length > 0) {
    return data.claims.email;
  }

  // Some Supabase user metadata may contain an email
  if (
    typeof data.user?.user_metadata?.email === "string" &&
    data.user.user_metadata.email.length > 0
  ) {
    return data.user.user_metadata.email;
  }

  return undefined;
}

const dashboardRoutes: Route[] = [
  {
    id: "overview",
    title: "Overview",
    icon: <Home className="size-4" />,
    link: "/dashboard",
  },
  {
    id: "books",
    title: "Books",
    icon: <Book className="size-4" />,
    link: "/dashboard/books",
  },
];

const teams = [{ id: "1", name: "Alpha Inc.", logo: Logo }];

export default function DashboardSidebar({ data }: { data: any }) {
  const { state, isMobile } = useSidebar();
  const isCollapsed = state === "collapsed";

  // Normalize email once so the template below is simple and resilient
  const email = getEmailFromData(data);

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader
        className={cn(
          "flex md:pt-3.5",
          isCollapsed
            ? "flex-row items-center justify-between gap-y-4 md:flex-col md:items-start md:justify-start"
            : "flex-row items-center justify-between",
        )}
      >
        <a href="#" className="flex items-center gap-2">
          <Logo className="h-8 w-8" />
          {!isCollapsed && (
            <span className="font-semibold text-black dark:text-white">
              Acme
            </span>
          )}
        </a>

        <motion.div
          key={isCollapsed ? "header-collapsed" : "header-expanded"}
          className={cn(
            "flex items-center gap-2",
            isCollapsed ? "flex-row md:flex-col-reverse" : "flex-row",
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <SidebarTrigger />
        </motion.div>
      </SidebarHeader>

      <SidebarContent className="gap-4 px-2 py-4">
        <DashboardNavigation routes={dashboardRoutes} />
      </SidebarContent>
      <SidebarFooter className="px-2">
        <div className="flex justify-start">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-background text-foreground">
                      <User className="size-4" />
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {email ?? "Account"}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-auto" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg mb-4"
                  align="start"
                  side={isMobile ? "bottom" : "right"}
                  sideOffset={4}
                >
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    {email ?? "No email available"}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <LogoutButton>
                    <DropdownMenuItem>
                      <span className="w-full block">Sign out</span>
                    </DropdownMenuItem>
                  </LogoutButton>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
