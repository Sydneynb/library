import { createClient, type SupabaseClient } from "@supabase/supabase-js";
export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL environment variable (required for Supabase).",
    );
  }
  if (!serviceKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY environment variable. This key is required for privileged server-side operations.",
    );
  }
  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
    },
  });
}
