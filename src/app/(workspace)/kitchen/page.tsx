import { requireContext } from "@/features/auth/context";
import { readKitchenTickets } from "@/features/orders/workflow-queries";
import { KitchenBoard } from "@/features/orders/kitchen-board";
import { PageHeading } from "@/components/page-heading";
export const metadata = { title: "آشپزخانه" };
export default async function KitchenPage() {
  const { panelRole } = await requireContext();
  const initial = await readKitchenTickets();
  return (
    <>
      <PageHeading
        eyebrow="هماهنگی آشپزخانه"
        title="از سفارش تا آماده سرو"
        description="آیتم‌های ارسال‌شده، شماره میز و وضعیت آماده‌سازی در محدوده شعبه شما."
        badge="آشپزخانه"
      />
      <KitchenBoard initial={initial} role={panelRole} />
    </>
  );
}
