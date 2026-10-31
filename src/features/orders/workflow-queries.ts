import "server-only";
import { z } from "zod";
import { readContext } from "@/features/auth/context";
import { dataUnavailable } from "@/lib/data-error";
import {
  orderSchema,
  workflowItemSchema,
  tableSchema,
  eventSchema,
  orderTotal,
  type OrderView,
  type TableSummary,
} from "./workflow-model";
type Context = Awaited<ReturnType<typeof readContext>>;
const active = ["draft", "submitted", "in_preparation", "ready", "served"];
export async function readTableSummaries(
  context?: Context,
): Promise<TableSummary[]> {
  const { supabase, membership } = context ?? (await readContext());
  let tables = supabase
    .from("dining_tables")
    .select("id,label,seats,is_active,branch_id,branches(name)")
    .eq("is_active", true)
    .eq("restaurant_id", membership.restaurant_id)
    .order("label");
  let orders = supabase
    .from("orders")
    .select("id,table_id,branch_id,status,version,created_at")
    .eq("restaurant_id", membership.restaurant_id)
    .in("status", active);
  let ready = supabase
    .from("order_items")
    .select("order_id")
    .eq("restaurant_id", membership.restaurant_id)
    .eq("status", "ready");
  if (membership.branch_id) {
    tables = tables.eq("branch_id", membership.branch_id);
    orders = orders.eq("branch_id", membership.branch_id);
    ready = ready.eq("branch_id", membership.branch_id);
  }
  const [t, o, r] = await Promise.all([tables, orders, ready]);
  const pt = z.array(tableSchema).safeParse(t.data),
    po = z.array(orderSchema).safeParse(o.data),
    pr = z.array(z.object({ order_id: z.uuid() })).safeParse(r.data);
  if (
    t.error ||
    o.error ||
    r.error ||
    !pt.success ||
    !po.success ||
    !pr.success
  )
    dataUnavailable();
  return pt.data.map((table) => {
    const order = po.data.find((o) => o.table_id === table.id) || null;
    return {
      ...table,
      order,
      readyCount: order
        ? pr.data.filter((item) => item.order_id === order.id).length
        : 0,
    };
  });
}
export async function readOrderView(
  tableId: string,
  context?: Context,
): Promise<OrderView | null> {
  const ctx = context ?? (await readContext());
  const { supabase, membership } = ctx;
  const tables = await readTableSummaries(ctx);
  const table = tables.find((t) => t.id === tableId);
  if (!table) return null;
  if (!table.order)
    return { table, order: null, items: [], totalIrr: 0, events: [] };
  const [i, e] = await Promise.all([
    supabase
      .from("order_items")
      .select(
        "id,order_id,name_snapshot,unit_price_irr,quantity,notes,status,version,submitted_at,served_at,served_by",
        { count: "exact" },
      )
      .eq("restaurant_id", membership.restaurant_id)
      .eq("branch_id", table.branch_id)
      .eq("order_id", table.order.id)
      .order("submitted_at")
      .order("id"),
    supabase
      .from("order_events")
      .select("id,event_type,order_version,created_at")
      .eq("restaurant_id", membership.restaurant_id)
      .eq("branch_id", table.branch_id)
      .eq("order_id", table.order.id)
      .order("order_version", { ascending: false })
      .limit(20),
  ]);
  const pi = z.array(workflowItemSchema).safeParse(i.data),
    pe = z.array(eventSchema).safeParse(e.data);
  if (
    i.error ||
    e.error ||
    !pi.success ||
    !pe.success ||
    i.count !== pi.data.length
  )
    dataUnavailable();
  return {
    table,
    order: table.order,
    items: pi.data,
    totalIrr: orderTotal(pi.data),
    events: pe.data,
  };
}
export const kitchenTicketSchema = workflowItemSchema.extend({
  orders: z.object({
    status: orderSchema.shape.status,
    dining_tables: z.object({ label: z.string() }),
    branches: z.object({ name: z.string() }),
  }),
});
export type KitchenTicket = z.infer<typeof kitchenTicketSchema>;
export async function readKitchenTickets(context?: Context) {
  const { supabase, membership } = context ?? (await readContext());
  let q = supabase
    .from("order_items")
    .select(
      "id,order_id,name_snapshot,unit_price_irr,quantity,notes,status,version,submitted_at,served_at,served_by,orders!inner(status,dining_tables(label),branches(name))",
    )
    .eq("restaurant_id", membership.restaurant_id)
    .in("status", ["queued", "preparing", "ready"])
    .in("orders.status", ["submitted", "in_preparation", "ready"])
    .order("submitted_at")
    .order("id")
    .limit(101);
  if (membership.branch_id) q = q.eq("branch_id", membership.branch_id);
  const { data, error } = await q;
  const parsed = z.array(kitchenTicketSchema).safeParse(data);
  if (error || !parsed.success) dataUnavailable();
  return {
    items: parsed.data.slice(0, 100),
    truncated: parsed.data.length > 100,
  };
}
