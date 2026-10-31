import Link from "next/link";
import { logout } from "@/features/auth/actions";
export const metadata = { title: "دسترسی مجاز نیست" };
export default async function AccessDeniedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="auth-page">
      <section className="panel auth-card">
        <h1>دسترسی به فضای کار ممکن نیست</h1>
        <p>
          {error === "database"
            ? "ارتباط با اطلاعات دسترسی برقرار نشد. دوباره تلاش کنید."
            : error === "logout"
              ? "خروج کامل نشد. دوباره تلاش کنید."
              : "عضویت فعال برای این حساب پیدا نشد. با مسئول رستوران تماس بگیرید."}
        </p>
        <Link className="button" href="/">
          بررسی دوباره دسترسی
        </Link>
        <form action={logout}>
          <button className="button" type="submit">
            خروج از حساب
          </button>
        </form>
      </section>
    </main>
  );
}
