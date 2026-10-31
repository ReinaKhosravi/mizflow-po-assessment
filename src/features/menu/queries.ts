import "server-only";
import { z } from "zod";
import { requireContext } from "@/features/auth/context";
import { irrSchema } from "@/lib/money";
import { dataUnavailable } from "@/lib/data-error";

export async function readMenu() {
  const { supabase, membership } = await requireContext();
  let query = supabase
    .from("menu_items")
    .select(
      "id, name, category, description, price_irr, is_available, branch_id, branches(name)",
    )
    .eq("restaurant_id", membership.restaurant_id)
    .order("category")
    .order("name");
  if (membership.branch_id) query = query.eq("branch_id", membership.branch_id);
  const { data, error } = await query;
  const parsed = z
    .array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        category: z.string(),
        description: z.string(),
        price_irr: irrSchema,
        is_available: z.boolean(),
        branch_id: z.uuid(),
        branches: z.object({ name: z.string() }),
      }),
    )
    .safeParse(data);
  if (error || !parsed.success) {
    dataUnavailable();
  }
  return parsed.data;
}
