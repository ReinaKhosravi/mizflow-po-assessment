import { requireContext } from "@/features/auth/context";
import { readTableSummaries } from "@/features/orders/workflow-queries";
import { TablesBoard } from "@/features/orders/tables-board";
import { PageHeading } from "@/components/page-heading";
export const metadata = { title: "میزها" };
export default async function TablesPage() {
  const { panelRole } = await requireContext();
  const initial = await readTableSummaries();
  return (
    <>
      <PageHeading
        eyebrow="فضای سالن"
        title="ثبت سفارش میز"
        description="۱. میز را انتخاب کنید  ۲. نشستن مهمان و ارائه منو را ثبت کنید  ۳. آیتم‌ها را اضافه و به آشپزخانه ارسال کنید."
        badge="سالن"
      />
      <TablesBoard initial={initial} role={panelRole} />
    </>
  );
}
