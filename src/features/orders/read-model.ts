import { z } from "zod";
import { irrSchema } from "@/lib/money";
export const orderStatusSchema = z.enum([
  "draft",
  "submitted",
  "in_preparation",
  "ready",
  "served",
  "closed",
  "cancelled",
]);
export const itemStatusSchema = z.enum([
  "queued",
  "preparing",
  "ready",
  "served",
  "cancelled",
]);
export const itemReadSchema = z.object({
  id: z.uuid(),
  order_id: z.uuid(),
  branch_id: z.uuid(),
  name_snapshot: z.string(),
  quantity: z.number().int().positive(),
  unit_price_irr: irrSchema,
  status: itemStatusSchema,
  notes: z.string(),
  created_at: z.string(),
  orders: z.object({
    status: orderStatusSchema,
    branches: z.object({ name: z.string() }),
  }),
});
export type KitchenItem = z.infer<typeof itemReadSchema>;
export const activeOrderStatuses = [
  "submitted",
  "in_preparation",
  "ready",
  "served",
] as const;
export function kitchenColumns(items: KitchenItem[]) {
  return ["queued", "preparing", "ready"].map((status) => ({
    status,
    items: items.filter((item) => item.status === status),
  }));
}
