"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton({ children }: React.PropsWithChildren) {
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();

    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Error signing out:", err);
    }
    router.push("/auth/login");
  };

  return <div onClick={logout}>{children}</div>;
}
