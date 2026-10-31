import Link from "next/link";
export const metadata = { title: "راه‌اندازی اتصال" };
export default function SetupPage() {
  return (
    <main className="auth-page">
      <section className="panel auth-card">
        <span className="eyebrow">میزفلو</span>
        <h1>اتصال امن آماده نیست</h1>
        <p>
          برای ورود به فضای کار، اتصال Supabase باید تنظیم شود. با مسئول
          راه‌اندازی تماس بگیرید.
        </p>
        <p className="page-note">
          راهنمای تنظیمات و اجرای پایگاه داده در README پروژه قرار دارد. تا
          تکمیل تنظیمات، اطلاعات خصوصی نمایش داده نمی‌شود.
        </p>
        <Link className="button" href="/login">
          رفتن به ورود
        </Link>
      </section>
    </main>
  );
}
