export function PageHeading({
  eyebrow,
  title,
  description,
  badge = "نمای اولیه",
}: {
  eyebrow: string;
  title: string;
  description: string;
  badge?: string;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <span className="outline-pill">{badge}</span>
    </div>
  );
}
export function PreviewNotice() {
  return (
    <div className="notice">
      <span aria-hidden="true">ⓘ</span>
      <p>
        <strong>این فضا پیش‌نمایش است.</strong> طراحی گردش کار نمونه است؛ منو و
        میزها از پایگاه داده خوانده می‌شوند. ثبت و تغییر سفارش‌ها و اتصال زنده
        به آشپزخانه هنوز فعال نیست.
      </p>
    </div>
  );
}
