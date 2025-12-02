import { createClient } from "@/lib/supabase/server";
import LayoutShell from "./layout-shell";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  return <LayoutShell>{children}</LayoutShell>;
}
