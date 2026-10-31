import Link from "next/link";
import { menuItemIcon } from "@/features/menu/item-icon";
import { requireContext } from "@/features/auth/context";
import { PageHeading } from "@/components/page-heading";
import { readMenu } from "@/features/menu/queries";
import { formatToman } from "@/lib/money";
export const metadata = { title: "منوی کافه" };
export default async function MenuPage() {
  const { restaurantName, branchName, panelRole } = await requireContext();
  const menu = await readMenu();
  return (
    <>
      <PageHeading
        eyebrow="طعم‌های کافه"
        title="یک منوی ساده و آشنا"
        description="آیتم‌ها و قیمت‌ها از پایگاه داده خوانده می‌شوند؛ ویرایش در رابط هنوز فعال نیست."
        badge="اطلاعات پایگاه داده"
      />

      {panelRole !== "kitchen" && (
        <div className="panel order-entry-notice">
          <p>
            برای ثبت سفارش، ابتدا میز مهمان را انتخاب کنید؛ سپس آیتم‌های این منو
            را به سفارش اضافه کنید.
          </p>
          <Link className="button" href="/tables">
            ثبت سفارش · انتخاب میز
          </Link>
        </div>
      )}
      <div className="section-heading">
        <div>
          <h2>منوی {restaurantName}</h2>
          <p>
            {branchName} · {new Intl.NumberFormat("fa-IR").format(menu.length)}{" "}
            آیتم
          </p>
        </div>
        <span className="outline-pill">قیمت‌ها به تومان</span>
      </div>
      <div className="menu-grid">
        {menu.map((item) => (
          <article className="panel menu-card" key={item.id}>
            <div className="menu-image" aria-hidden="true">
              {menuItemIcon(item.name, item.category)}
            </div>
            <span className="eyebrow">
              {item.category} · {item.branches.name}
            </span>
            <h2>{item.name}</h2>
            <p>{item.description}</p>
            <div className="menu-price">
              <strong>{formatToman(item.price_irr)}</strong>
              <span>{item.is_available ? "موجود" : "ناموجود"}</span>
            </div>
          </article>
        ))}
      </div>
      {menu.length === 0 && (
        <p className="panel">هنوز آیتمی برای این محدوده ثبت نشده است.</p>
      )}
      <p className="page-note">
        مبالغ در داده‌ها به‌صورت عدد صحیح ریال نگهداری می‌شوند. هر ۱۰ ریال = ۱
        تومان.
      </p>
    </>
  );
}
