import { tableDisplayName } from "@/features/tables/sort";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireContext } from "@/features/auth/context";
import { readOrderView } from "@/features/orders/workflow-queries";
import { readMenu } from "@/features/menu/queries";
import { OrderEditor } from "@/features/orders/order-editor";
import { PageHeading } from "@/components/page-heading";
export default async function TableOrderPage({
  params,
}: {
  params: Promise<{ tableId: string }>;
}) {
  const { panelRole } = await requireContext();
  const { tableId } = await params;
  if (!z.uuid().safeParse(tableId).success) notFound();
  const initial = await readOrderView(tableId);
  if (!initial) notFound();
  const menu = panelRole !== "kitchen" ? await readMenu() : [];
  return (
    <>
      <PageHeading
        eyebrow="سالن · سفارش میز"
        title={tableDisplayName(initial.table.label)}
        description="آیتم‌های ثبت‌شده و وضعیت آماده‌سازی به‌صورت خودکار تازه می‌شوند."
        badge="سفارش میز"
      />
      <OrderEditor initial={initial} menu={menu} role={panelRole} />
    </>
  );
}
