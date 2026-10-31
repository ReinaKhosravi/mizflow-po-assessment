import { PageHeading, PreviewNotice } from "@/components/page-heading";
import { sampleMenu } from "@/features/menu/sample-menu";
import { formatToman } from "@/lib/money";
export const metadata = { title: "منوی کافه" };
export default function MenuPage() {
 return <><PageHeading eyebrow="طعم‌های کافه" title="یک منوی ساده و آشنا" description="آیتم‌ها و قیمت‌های نمونه برای نمایش ساختار منو؛ امکان ویرایش هنوز فعال نیست." /><PreviewNotice /><div className="section-heading"><div><h2>منوی نمونه نارون</h2><p>۶ آیتم نمایشی</p></div><span className="outline-pill">قیمت‌ها به تومان</span></div><div className="menu-grid">{sampleMenu.map(item => <article className="panel menu-card" key={item.name}><div className="menu-image" aria-hidden="true">{item.symbol}</div><span className="eyebrow">{item.category}</span><h2>{item.name}</h2><p>{item.description}</p><div className="menu-price"><strong>{formatToman(item.priceIrr)}</strong><span>نمونه</span></div></article>)}</div><p className="page-note">مبالغ در داده‌ها به‌صورت عدد صحیح ریال نگهداری می‌شوند. هر ۱۰ ریال = ۱ تومان.</p></>;
}
