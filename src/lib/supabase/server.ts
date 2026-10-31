import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { readSupabaseConfig } from "./config";

export async function createSupabaseServerClient() {
  const config = readSupabaseConfig();
  if (!config) throw new Error("Supabase configuration unavailable");
  const store = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      path: "/",
    },
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try {
          for (const { name, value, options } of values)
            store.set(name, value, options);
        } catch {
          /* Server Components cannot write cookies; proxy refreshes them first. */
        }
      },
    },
  });
}
