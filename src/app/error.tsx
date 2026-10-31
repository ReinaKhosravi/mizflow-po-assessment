"use client";
import Link from "next/link";
export default function AppError({ retry }: { retry: () => void }) {
  return (
    <main className="auth-page">
      <section className="panel auth-card" role="alert">
        <h1>دریافت اطلاعات انجام نشد</h1>
        <p>
          اتصال را بررسی و دوباره تلاش کنید. اطلاعات نمونه جایگزین داده‌های شما
          نمی‌شود.
        </p>
        <button type="button" className="button" onClick={() => retry()}>
          تلاش دوباره
        </button>
        <p>
          <Link href="/login">بازگشت به ورود</Link>
        </p>
      </section>
    </main>
  );
}
