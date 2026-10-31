import { z } from "zod";
import { irrSchema } from "@/lib/money";
import { itemStatusSchema, orderStatusSchema } from "./read-model";
export const lineInputSchema = z
  .object({
    menu_item_id: z.uuid(),
    quantity: z.number().int().min(1).max(100),
    notes: z.string().max(500).default(""),
  })
  .strict();
export const openInputSchema = z
  .object({ tableId: z.uuid(), key: z.uuid() })
  .strict();
export const addInputSchema = z
  .object({
    orderId: z.uuid(),
    key: z.uuid(),
    items: z.array(lineInputSchema).min(1).max(30),
  })
  .strict();
export const advanceInputSchema = z
  .object({
    itemId: z.uuid(),
    expectedVersion: z.number().int().positive(),
    nextStatus: z.enum(["preparing", "ready"]),
    key: z.uuid(),
  })
  .strict();
export const tableSchema = z.object({
  id: z.uuid(),
  label: z.string(),
  seats: z.number().int(),
  is_active: z.boolean(),
  branch_id: z.uuid(),
  branches: z.object({ name: z.string() }),
});
export const orderSchema = z.object({
  id: z.uuid(),
  table_id: z.uuid(),
  branch_id: z.uuid(),
  status: orderStatusSchema,
  version: z.number().int().positive(),
  created_at: z.string(),
});
export const workflowItemSchema = z.object({
  id: z.uuid(),
  order_id: z.uuid(),
  name_snapshot: z.string(),
  unit_price_irr: irrSchema,
  quantity: z.number().int().positive(),
  notes: z.string(),
  status: itemStatusSchema,
  version: z.number().int().positive(),
  submitted_at: z.string(),
  served_at: z.string().nullable(),
  served_by: z.uuid().nullable(),
});
export type WorkflowItem = z.infer<typeof workflowItemSchema>;
export type Order = z.infer<typeof orderSchema>;
export type DiningTable = z.infer<typeof tableSchema>;
export type TableSummary = DiningTable & {
  order: Order | null;
  readyCount: number;
};
export const eventSchema = z.object({
  id: z.uuid(),
  event_type: z.string(),
  order_version: z.number().int(),
  created_at: z.string(),
});
export type OrderView = {
  table: DiningTable;
  order: Order | null;
  items: WorkflowItem[];
  totalIrr: number;
  events: z.infer<typeof eventSchema>[];
};
export const statusLabels: Record<WorkflowItem["status"], string> = {
  queued: "در انتظار",
  preparing: "در حال آماده‌سازی",
  ready: "آماده سرو",
  served: "سرو شده",
  cancelled: "لغوشده",
};
export function orderTotal(
  items: Pick<WorkflowItem, "unit_price_irr" | "quantity" | "status">[],
) {
  const result = items.reduce(
    (sum, item) =>
      item.status === "cancelled"
        ? sum
        : sum + BigInt(item.unit_price_irr) * BigInt(item.quantity),
    BigInt(0),
  );
  if (result > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("Invalid persisted total");
  return Number(result);
}
export type MutationResult =
  | { ok: true; orderId: string }
  | {
      ok: false;
      code: "invalid" | "forbidden" | "conflict" | "unavailable";
      message: string;
      retryable: boolean;
    };
export function mutationError(
  code?: string,
  message?: string,
): Extract<MutationResult, { ok: false }> {
  if (code === "42501")
    return {
      ok: false,
      code: "forbidden",
      message: "دسترسی به این عملیات مجاز نیست یا اطلاعات در دسترس شما نیست.",
      retryable: false,
    };
  if (code === "PT409" || code === "40001" || code === "23505")
    return {
      ok: false,
      code: "conflict",
      message:
        "سفارش تغییر کرده است. اطلاعات تازه را بررسی و دوباره اقدام کنید.",
      retryable: false,
    };
  if (code?.startsWith("22"))
    return {
      ok: false,
      code: "invalid",
      message:
        message === "MF_IDEMPOTENCY_MISMATCH"
          ? "این درخواست قبلاً با اطلاعات دیگری ثبت شده است؛ وضعیت سفارش را بررسی کنید."
          : message === "MF_MENU_UNAVAILABLE"
            ? "یکی از آیتم‌های منو دیگر قابل سفارش نیست."
            : "اطلاعات یا تغییر وضعیت درخواستی معتبر نیست.",
      retryable: false,
    };
  return {
    ok: false,
    code: "unavailable",
    message:
      "نتیجه درخواست هنوز مشخص نیست. برای جلوگیری از ثبت تکراری، همان درخواست را دوباره بررسی کنید.",
    retryable: true,
  };
}

export const serviceInputSchema = z
  .object({
    targetId: z.uuid(),
    expectedVersion: z.number().int().positive(),
    key: z.uuid(),
  })
  .strict();
