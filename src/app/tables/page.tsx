import { PageHeading, PreviewNotice } from "@/components/page-heading";
export const metadata = { title: "میزها" };
export default function TablesPage() {
 return <><PageHeading eyebrow="فضای سالن" title="هر میز، آغاز یک تجربه" description="چیدمان نمونه برای یک کافه با ۱۲ میز؛ وضعیت واقعی هنوز متصل نیست." /><PreviewNotice /><section className="panel"><div className="section-heading"><div><h2>سالن اصلی</h2><p>۱۲ میز نمونه · ظرفیت پیشنهادی ۴۰ نفر</p></div><span className="soft-pill">چیدمان پیشنهادی</span></div><div className="tables-grid">{Array.from({length:12}, (_,i) => <article className="table-card" key={i}><span className="table-symbol" aria-hidden="true">▦</span><h3>میز {new Intl.NumberFormat("fa-IR", {minimumIntegerDigits:2}).format(i+1)}</h3><p>{i < 8 ? "۴" : "۲"} نفره</p><span className="outline-pill">وضعیت متصل نیست</span></article>)}</div></section></>;
}
