import Link from "next/link";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { LoginForm } from "./login-form";
export const metadata = { title: "ورود کارکنان" };
export const dynamic = "force-dynamic";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const configured = !!readSupabaseConfig();
  return (
    <main className="auth-page">
      <section className="panel auth-card">
        <span className="eyebrow">میزفلو · فضای کار کافه</span>
        <h1>ورود کارکنان</h1>
        <p>با حسابی که برای رستوران شما ایجاد شده وارد شوید.</p>
        {error === "unavailable" && (
          <p role="alert">ارتباط با سرویس ورود برقرار نشد.</p>
        )}
        {configured ? (
          <LoginForm />
        ) : (
          <div className="notice">
            <p>
              اتصال امن هنوز تنظیم نشده است.{" "}
              <Link href="/setup">راهنمای راه‌اندازی</Link>
            </p>
          </div>
        )}
        <p className="page-note">
          ثبت‌نام عمومی فعال نیست. دسترسی کارکنان باید توسط مسئول راه‌اندازی
          ایجاد شود.
        </p>
      </section>
    </main>
  );
}
