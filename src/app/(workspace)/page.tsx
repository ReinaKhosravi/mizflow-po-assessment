import { requireContext } from "@/features/auth/context";
import Link from "next/link";
import { readDashboard } from "@/features/orders/queries";
import { PageHeading } from "@/components/page-heading";

export default async function Dashboard() {
  await requireContext();
  const counts = await readDashboard();
  return (
    <>
      <PageHeading
        eyebrow="نمای کلی کافه"
        title="یک شیفت روان، یک تجربه بهتر"
        description="میزها، سفارش‌ها و آشپزخانه؛ همه در یک نگاه."
        badge="اطلاعات پایگاه داده"
      />
      <div className="notice">
        <p>
          پیشخدمت از بخش میزها سفارش ثبت می‌کند و آشپزخانه وضعیت آماده‌سازی را
          تغییر می‌دهد. وضعیت سفارش‌ها خودکار تازه می‌شود؛ آمار این پیشخوان با
          بارگذاری صفحه به‌روز می‌شود.
        </p>
      </div>
      <section className="hero">
        <div>
          <span className="hero-label">از اولین سفارش تا آخرین فنجان</span>
          <h2>همه‌چیز سرِ جای خودش.</h2>
          <p>
            مسیر کوتاه‌تر سفارش‌ها، فرصت بیشتر برای مهمان‌ها.
            <br />
            فضای کار ساده برای تیم سالن و آشپزخانه.
          </p>
          <Link className="button" href="/tables">
            مشاهده میزها <span aria-hidden="true">←</span>
          </Link>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="cup">☕</div>
          <span className="art-label label-one">از سالن</span>
          <span className="art-label label-two">تا آشپزخانه</span>
          <span className="spark">✧</span>
        </div>
      </section>
      <section className="stats" aria-label="شاخص‌های ثبت‌شده">
        {[
          {
            label: "میزهای کافه",
            value: new Intl.NumberFormat("fa-IR").format(counts[0]),
            unit: "در محدوده دسترسی شما",
            icon: "▦",
          },
          {
            label: "سفارش‌های باز",
            value: new Intl.NumberFormat("fa-IR").format(counts[1]),
            unit: "سفارش ثبت‌شده و بسته‌نشده",
            icon: "☷",
          },
          {
            label: "در حال آماده‌سازی",
            value: new Intl.NumberFormat("fa-IR").format(counts[2]),
            unit: "آیتم در حال تهیه",
            icon: "♨",
          },
          {
            label: "آماده سرو",
            value: new Intl.NumberFormat("fa-IR").format(counts[3]),
            unit: "آیتم آماده تحویل",
            icon: "✓",
          },
        ].map((stat) => (
          <article className="stat" key={stat.label}>
            <div>
              <span>{stat.label}</span>
              <i aria-hidden="true">{stat.icon}</i>
            </div>
            <strong>{stat.value}</strong>
            <small>{stat.unit}</small>
          </article>
        ))}
      </section>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>مسیر یک سفارش</h2>
              <p>هماهنگی سالن و آشپزخانه در سه قدم</p>
            </div>
            <span className="soft-pill">مراحل کار</span>
          </div>
          <ol className="workflow">
            {[
              {
                title: "ثبت در سالن",
                text: "پیشخدمت، میز و آیتم‌های سفارش را مشخص می‌کند.",
              },
              {
                title: "آماده‌سازی در آشپزخانه",
                text: "آشپزخانه، آیتم‌ها را دریافت و وضعیت را به‌روز می‌کند.",
              },
              {
                title: "آماده برای مهمان",
                text: "پیشخدمت از آماده‌شدن آیتم‌ها مطلع می‌شود.",
              },
            ].map((step, i) => (
              <li key={step.title}>
                <span>{new Intl.NumberFormat("fa-IR").format(i + 1)}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section className="panel quick-links">
          <div className="section-heading">
            <div>
              <h2>دسترسی سریع</h2>
              <p>فضای کار هر بخش از تیم</p>
            </div>
          </div>
          <Link href="/tables">
            <span className="quick-icon">▦</span>
            <div>
              <strong>سالن و میزها</strong>
              <small>چیدمان میزهای کافه</small>
            </div>
            <b>←</b>
          </Link>
          <Link href="/kitchen">
            <span className="quick-icon">♨</span>
            <div>
              <strong>تابلوی آشپزخانه</strong>
              <small>مسیر آماده‌سازی آیتم‌ها</small>
            </div>
            <b>←</b>
          </Link>
          <Link href="/menu">
            <span className="quick-icon">☷</span>
            <div>
              <strong>منوی کافه</strong>
              <small>آیتم‌ها و قیمت‌های ثبت‌شده</small>
            </div>
            <b>←</b>
          </Link>
        </section>
      </div>
    </>
  );
}
