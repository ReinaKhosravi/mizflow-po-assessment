export function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div><span className="outline-pill">داده‌های نمایشی</span></div>;
}
export function PreviewNotice() {
  return <div className="notice"><span aria-hidden="true">ⓘ</span><p><strong>این فضا پیش‌نمایش است.</strong> اطلاعات نمونه‌اند؛ ثبت سفارش، ورود کارکنان و اتصال به آشپزخانه هنوز فعال نیست.</p></div>;
}
