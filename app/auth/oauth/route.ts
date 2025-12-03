import { NextResponse } from "next/server";
// The client you created from the Server-Side Auth instructions
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // if "next" is in param, use it as the redirect URL
  let next = searchParams.get("next") ?? "/";
  if (!next.startsWith("/")) {
    // if "next" is not a relative URL, use the default
    next = "/";
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host"); // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === "development";

      // Prefer an explicit site URL configured in env for production deployments.
      // This avoids redirects pointing at `origin` (which may be localhost when behind proxies).
      const configuredSite =
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.SITE_URL ||
        process.env.VERCEL_URL ||
        undefined;

      if (isLocalEnv) {
        // In development keep using the request origin so localhost flows still work
        return NextResponse.redirect(`${origin}${next}`);
      }

      if (configuredSite) {
        // Normalize configuredSite to include protocol and remove trailing slash
        let base = String(configuredSite).trim();
        if (!/^https?:\/\//i.test(base)) {
          // assume https for non-local hosts
          base = base.startsWith("localhost")
            ? `http://${base}`
            : `https://${base}`;
        }
        base = base.replace(/\/$/, "");
        return NextResponse.redirect(`${base}${next}`);
      }

      // Fallback to forwarded host (commonly set by proxies) and finally origin
      if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/error`);
}
