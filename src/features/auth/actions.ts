"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { logSecurityEvent } from "@/lib/logger";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(1).max(128),
});
export async function login(
  _previous: { error: string },
  formData: FormData,
): Promise<{ error: string }> {
  if (!readSupabaseConfig()) return { error: "اتصال امن هنوز تنظیم نشده است." };
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "ایمیل و گذرواژه معتبر وارد کنید." };
  const supabase = await createSupabaseServerClient();
  let failure = "";
  try {
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) {
      logSecurityEvent("auth_failed", error.status);
      failure =
        error.status === 429
          ? "تعداد تلاش‌ها زیاد شده است. کمی صبر کنید و دوباره امتحان کنید."
          : error.code === "invalid_credentials"
            ? "ایمیل یا گذرواژه درست نیست. گذرواژه را با دکمه نمایش بررسی کنید."
            : error.code === "email_not_confirmed"
              ? "ایمیل این حساب هنوز تأیید نشده است. با مسئول راه‌اندازی تماس بگیرید."
              : "ارتباط با سرویس ورود برقرار نشد. اتصال را بررسی و دوباره تلاش کنید.";
    }
  } catch {
    logSecurityEvent("auth_unavailable");
    failure =
      "ارتباط با سرویس ورود برقرار نشد. اتصال را بررسی و دوباره تلاش کنید.";
  }
  if (failure) return { error: failure };
  revalidatePath("/", "layout");
  redirect("/"); // Fixed local destination; never trust a browser redirect URL.
}
export async function logout() {
  if (!readSupabaseConfig()) redirect("/setup");
  const supabase = await createSupabaseServerClient();
  const result = await supabase.auth
    .signOut({ scope: "local" })
    .catch(() => null);
  if (!result || result.error) {
    logSecurityEvent("logout_failed");
    redirect("/access-denied?error=logout");
  }
  revalidatePath("/", "layout");
  redirect("/login");
}
