import Link from "next/link";
export default function NotFound() { return <section className="panel empty-state"><h1>این صفحه پیدا نشد</h1><p>از فهرست، بخش مورد نظر را انتخاب کنید.</p><Link className="button" href="/">بازگشت به پیشخوان</Link></section>; }
