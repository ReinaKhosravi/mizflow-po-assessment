import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { logSecurityEvent } from "@/lib/logger";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  const config = readSupabaseConfig();
  if (!config) return response; // Protected pages independently fail closed to /setup.
  const supabase = createServerClient(config.url, config.key, {
    cookieOptions: {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      path: "/",
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        for (const { name, value } of values) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        response.headers.set("Cache-Control", "private, no-store");
        for (const { name, value, options } of values)
          response.cookies.set(name, value, options);
      },
    },
  });
  try {
    await supabase.auth.getUser();
  } catch {
    logSecurityEvent("auth_unavailable");
  }
  // Refresh only. Authorization is in every protected page/data entry point + RLS.
  return response;
}
export const config = {
  matcher: [
    "/",
    "/tables/:path*",
    "/menu/:path*",
    "/kitchen/:path*",
    "/login",
    "/access-denied",
    "/api/operations",
  ],
};
