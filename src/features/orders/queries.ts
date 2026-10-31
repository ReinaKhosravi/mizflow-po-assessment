import "server-only";
import { z } from "zod";
import { requireContext } from "@/features/auth/context";
import { dataUnavailable } from "@/lib/data-error";
import { activeOrderStatuses, itemReadSchema } from "./read-model";

export async function readDashboard() {
  const { supabase, membership } = await requireContext();
  const tableQuery = supabase
    .from("dining_tables")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .eq("restaurant_id", membership.restaurant_id);
  const orderQuery = supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", membership.restaurant_id)
    .in("status", activeOrderStatuses);
  const counts = [
    tableQuery,
    orderQuery,
    ...["preparing", "ready"].map((status) =>
      supabase
        .from("order_items")
        .select("id,orders!inner(status)", { count: "exact", head: true })
        .eq("restaurant_id", membership.restaurant_id)
        .in("orders.status", ["submitted", "in_preparation", "ready"])
        .eq("status", status),
    ),
  ];
  // Every query is additionally constrained by RLS; never accept a tenant/branch from the browser.
  const results = await Promise.all(
    counts.map((q) =>
      membership.branch_id ? q.eq("branch_id", membership.branch_id) : q,
    ),
  );
  if (results.some((r) => r.error || r.count === null)) dataUnavailable();
  return results.map((r) => r.count!);
}
export async function readKitchen() {
  const { supabase, membership } = await requireContext();
  let query = supabase
    .from("order_items")
    .select(
      "id,order_id,branch_id,name_snapshot,quantity,unit_price_irr,status,notes,created_at,orders!inner(status,branches(name))",
    )
    .eq("restaurant_id", membership.restaurant_id)
    .in("status", ["queued", "preparing", "ready"])
    .in("orders.status", ["submitted", "in_preparation", "ready"])
    .order("created_at")
    .order("id")
    .limit(101);
  if (membership.branch_id) query = query.eq("branch_id", membership.branch_id);
  const { data, error } = await query;
  const parsed = z.array(itemReadSchema).safeParse(data);
  if (error || !parsed.success) dataUnavailable();
  return {
    items: parsed.data.slice(0, 100),
    truncated: parsed.data.length > 100,
  };
}
